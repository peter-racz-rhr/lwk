package com.ante.app.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CodecTest {
    @Test fun roundTripsEveryField() {
        val state = BankState(
            day = "2026-10-31",
            limits = listOf(Limit("com.a", "A \"quoted\" app", 1200, 840)),
            ledger = listOf(Bet("Roulette", "com.a", -300, 1730000000000)),
            session = Session("com.a", 1730000000000, 300),
            parked = mapOf("com.b" to 120),
        )
        assertEquals(state, Codec.decode(Codec.encode(state)))
    }

    @Test fun nullSessionSurvivesRoundTrip() {
        val state = BankState(day = "d")
        assertNull(Codec.decode(Codec.encode(state)).session)
    }

    @Test fun garbageDecodesToEmptyState() {
        assertEquals(BankState(), Codec.decode("not json"))
        assertEquals(BankState(), Codec.decode(null))
        assertEquals(BankState(), Codec.decode(""))
    }

    @Test fun skipsMalformedEntries() {
        val json = """{"day":"d","limits":[{"pkg":"ok","label":"Ok","limitSec":60,"leftSec":60},{"label":"no pkg"}],"ledger":[]}"""
        val state = Codec.decode(json)
        assertEquals(1, state.limits.size)
        assertEquals("ok", state.limits[0].pkg)
    }
}
