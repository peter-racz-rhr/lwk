package com.ante.app.core

import org.json.JSONArray
import org.json.JSONObject

/** JSON (de)serialization for [BankState]. Decoding never throws: bad data yields an empty state. */
object Codec {
    fun encode(s: BankState): String = toJson(s).toString()

    fun toJson(s: BankState): JSONObject = JSONObject().apply {
        put("day", s.day)
        put("limits", JSONArray().apply {
            s.limits.forEach {
                put(JSONObject().put("pkg", it.pkg).put("label", it.label).put("limitSec", it.limitSec).put("leftSec", it.leftSec))
            }
        })
        put("ledger", JSONArray().apply {
            s.ledger.forEach {
                put(JSONObject().put("game", it.game).put("pkg", it.pkg).put("deltaSec", it.deltaSec).put("atMs", it.atMs))
            }
        })
        put("parked", JSONObject().apply { s.parked.forEach { (k, v) -> put(k, v) } })
        put("dayStartMs", s.dayStartMs)
        put("usedTodaySec", s.usedTodaySec)
        put("history", JSONArray().apply {
            s.history.forEach { put(JSONObject().put("day", it.day).put("usedSec", it.usedSec).put("wonSec", it.wonSec).put("lostSec", it.lostSec)) }
        })
        put("strict", s.strict)
        put("settingsPassUntilMs", s.settingsPassUntilMs)
        put("clock", JSONObject().put("wallMs", s.clock.wallMs).put("elapsedMs", s.clock.elapsedMs).put("lastTrustedMs", s.clock.lastTrustedMs).put("bootCount", s.clock.bootCount))
        val session = s.session
        if (session != null) {
            put("session", JSONObject().put("pkg", session.pkg).put("startedAtMs", session.startedAtMs).put("grantedSec", session.grantedSec))
        }
    }

    fun decode(raw: String?): BankState {
        if (raw.isNullOrBlank()) return BankState()
        return try {
            val o = JSONObject(raw)
            BankState(
                day = o.optString("day", ""),
                limits = o.optJSONArray("limits").objects().mapNotNull { j ->
                    val pkg = j.optString("pkg", "")
                    if (pkg.isEmpty()) null else Limit(pkg, j.optString("label", pkg), j.optInt("limitSec", 0), j.optInt("leftSec", 0))
                },
                ledger = o.optJSONArray("ledger").objects().mapNotNull { j ->
                    val pkg = j.optString("pkg", "")
                    if (pkg.isEmpty()) null else Bet(j.optString("game", ""), pkg, j.optInt("deltaSec", 0), j.optLong("atMs", 0))
                },
                session = o.optJSONObject("session")?.let { j ->
                    val pkg = j.optString("pkg", "")
                    if (pkg.isEmpty()) null else Session(pkg, j.optLong("startedAtMs", 0), j.optInt("grantedSec", 0))
                },
                parked = o.optJSONObject("parked")?.let { j ->
                    j.keys().asSequence().associateWith { j.optInt(it, 0) }
                } ?: emptyMap(),
                dayStartMs = o.optLong("dayStartMs", 0),
                usedTodaySec = o.optInt("usedTodaySec", 0),
                history = o.optJSONArray("history").objects().mapNotNull { j ->
                    val day = j.optString("day", "")
                    if (day.isEmpty()) null else DaySummary(day, j.optInt("usedSec", 0), j.optInt("wonSec", 0), j.optInt("lostSec", 0))
                },
                strict = o.optBoolean("strict", false),
                settingsPassUntilMs = o.optLong("settingsPassUntilMs", 0),
                clock = o.optJSONObject("clock")?.let { j ->
                    ClockAnchor(j.optLong("wallMs", 0), j.optLong("elapsedMs", 0), j.optLong("lastTrustedMs", 0), j.optInt("bootCount", -1))
                } ?: ClockAnchor(),
            )
        } catch (e: Exception) {
            BankState()
        }
    }

    private fun JSONArray?.objects(): List<JSONObject> {
        if (this == null) return emptyList()
        return (0 until length()).mapNotNull { optJSONObject(it) }
    }
}
