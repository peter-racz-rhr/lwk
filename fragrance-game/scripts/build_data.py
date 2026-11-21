#!/usr/bin/env python3
"""Build js/data.js from the Fragrantica dataset published on Kaggle.

Source: "Fragrantica.com Fragrance Dataset" (fra_cleaned.csv + fra_perfumes.csv),
https://www.kaggle.com/datasets/olgagmiufana1/fragrantica-com-fragrance-dataset

Usage:
    python3 scripts/build_data.py path/to/fra_cleaned.csv path/to/fra_perfumes.csv

Picks the 500 fragrances with the most Fragrantica rating votes, leaving out
houses from the Gulf states, and writes js/data.js.
"""
import ast, csv, json, re, sys, unicodedata
from pathlib import Path

LIMIT = 500
EXCLUDE_COUNTRIES = {"UAE", "United Arab Emirates", "Oman", "Saudi Arabia", "Kuwait", "Qatar", "Bahrain"}
GENDER = {"men": "Masculine", "women": "Feminine", "unisex": "Unisex"}
BRAND_NAMES = {
    "Dolce-Gabbana": "Dolce&Gabbana", "Viktor-Rolf": "Viktor&Rolf", "Hermes": "Hermès", "Lancome": "Lancôme",
    "Chloe": "Chloé", "Estee-Lauder": "Estée Lauder", "Maison-Martin-Margiela": "Maison Margiela",
    "Lacoste-Fragrances": "Lacoste", "Zadig-Voltaire": "Zadig & Voltaire", "Frederic-Malle": "Frédéric Malle",
    "Yves-Saint-Laurent": "Yves Saint Laurent", "By-Kilian": "Kilian", "Bvlgari": "Bvlgari",
    "Mugler": "Mugler", "Jo-Malone-London": "Jo Malone", "Narciso-Rodriguez": "Narciso Rodriguez",
}
YEAR_FIX = {6472: 2009, 7145: 2007, 56062: 2017, 59417: 2010}  # missing in the dataset; from Fragrantica (No 19 EDP has no agreed year)
# Spelling variants in the source that would stop the same note matching across bottles.
NOTE_FIX = {
    "vanille": "vanilla", "vanila": "vanilla", "woodsy notes": "woody notes", "virginian cedar": "virginia cedar",
    "oak moss": "oakmoss", "hiacynth": "hyacinth", "rhuburb": "rhubarb", "civetta": "civet", "cloves": "clove",
    "myrhh": "myrrh", "pitosporum": "pittosporum", "lily of the valley": "lily-of-the-valley", "vetyver": "vetiver",
    "cardamon": "cardamom", "watery notes": "water notes", "camelia": "camellia",
}


def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]", "", s.lower())


def clean_name(raw, brand_slug):
    name = re.sub(r"\s*for (women and men|women|men)\s*$", "", raw.replace("\xa0", " ")).strip()
    words = name.split()
    target = norm(brand_slug)
    for k in range(1, min(5, len(words)) + 1):
        if norm(" ".join(words[-k:])) == target and len(words) > k:
            return " ".join(words[:-k])
    return name


def notes(s):
    if isinstance(s, str):
        s = s.split(",")
    out = []
    for x in s:
        x = NOTE_FIX.get(x.strip(), x.strip())
        if x and x != "unknown" and x not in out:
            out.append(x)
    return out


def main(cleaned, perfumes):
    rows = list(csv.DictReader(open(cleaned, encoding="cp1252"), delimiter=";"))  # this file is Windows-1252
    extra = {}
    for r in csv.DictReader(open(perfumes, encoding="utf-8")):
        m = re.search(r"-(\d+)\.html", r["url"])
        if m:
            extra[int(m.group(1))] = r
    rows.sort(key=lambda r: -int(r["Rating Count"] or 0))
    out, seen = [], set()
    for r in rows:
        if r["Country"] in EXCLUDE_COUNTRIES:
            continue
        fid = int(re.search(r"-(\d+)\.html", r["url"]).group(1))
        p = extra.get(fid)
        if fid in seen or not p:
            continue
        slug = re.search(r"/perfume/([^/]+)/", p["url"]).group(1)
        brand = BRAND_NAMES.get(slug, slug.replace("-", " "))
        accords = ast.literal_eval(p["Main Accords"]) or [r["mainaccord%d" % i] for i in range(1, 6) if r["mainaccord%d" % i]]
        year = int(r["Year"]) if r["Year"].isdigit() else YEAR_FIX.get(fid)
        out.append({
            "id": fid, "url": re.search(r"/perfume/(.+\.html)", p["url"]).group(1),
            "name": clean_name(p["Name"], slug), "brand": brand, "country": r["Country"],
            "gender": GENDER.get(r["Gender"], "Unisex"), "year": year,
            "rating": round(float(r["Rating Value"].replace(",", ".")), 2), "votes": int(r["Rating Count"]),
            "perfumers": [re.sub(r"(^|[\s\-'])(\w)", lambda m: m.group(1) + m.group(2).upper(), x) for x in (r["Perfumer1"], r["Perfumer2"]) if x and x != "unknown"],
            "accords": [a.lower() for a in accords][:10],
            "top": notes(r["Top"]), "heart": notes(r["Middle"]), "base": notes(r["Base"]),
        
        })
        seen.add(fid)
        if len(out) == LIMIT:
            break
    # Pyramids Fragrantica has updated since the snapshot (data/overrides.json).
    overrides = json.loads((Path(__file__).resolve().parent.parent / "data" / "overrides.json").read_text(encoding="utf-8"))
    for f in out:
        o = overrides.get(str(f["id"]))
        if o:
            for tier in ("top", "heart", "base"):
                if tier in o:
                    f[tier] = notes(o[tier])
    # Same name and brand (e.g. Cool Water for men and for women): add the gender.
    keys = {}
    for f in out:
        keys.setdefault((f["name"], f["brand"]), []).append(f)
    for group in keys.values():
        if len(group) > 1:
            for f in group:
                f["name"] += {"Masculine": " (Men)", "Feminine": " (Women)", "Unisex": " (Unisex)"}[f["gender"]]
    dest = Path(__file__).resolve().parent.parent / "js" / "data.js"
    dest.write_text(
        "/* Generated by scripts/build_data.py from the Fragrantica dataset on Kaggle.\n"
        " * The 500 most-voted fragrances on Fragrantica, Gulf houses left out.\n"
        " * id is the Fragrantica perfume id; the bottle photo is fimgs.net/mdimg/perfume/375x500.<id>.jpg */\n"
        "window.FRAGRANCES = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")).replace("},{", "},\n{") + ";\n",
        encoding="utf-8")
    print("wrote", len(out), "fragrances to", dest)


if __name__ == "__main__":
    main(*sys.argv[1:3])
