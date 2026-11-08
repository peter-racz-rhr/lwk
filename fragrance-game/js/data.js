/*
 * Fragrance dataset for Blind Spritz.
 *
 * Note pyramids follow the layout Fragrantica uses (top / heart / base).
 * Longevity (1-5), sillage (1-4) and popularity (1-5) are approximations of
 * Fragrantica community votes, rounded to the nearest step.
 *
 * To refresh or extend this list from Fragrantica, run
 *   node scripts/fetch-fragrantica.mjs urls.txt
 * on your own machine (see README.md).
 *
 * Row format:
 *   F(name, brand, house, country, gender, year, concentration, family,
 *     "accords", "top notes", "heart notes", "base notes",
 *     longevity, sillage, popularity)
 *
 * house:  D designer · N niche · A arabian · C celebrity · I indie
 * gender: M masculine · F feminine · U unisex
 * concentration: EDC, EDT, EDP, Parfum, Extrait
 */
(function () {
  const HOUSE = { D: "Designer", N: "Niche", A: "Arabian", C: "Celebrity", I: "Indie" };
  const GENDER = { M: "Masculine", F: "Feminine", U: "Unisex" };
  const list = (s) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : []);
  const rows = [];
  function F(name, brand, house, country, gender, year, conc, family, accords, top, mid, base, lon, sil, pop) {
    rows.push({
      id: (brand + "-" + name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      name, brand, house: HOUSE[house], country, gender: GENDER[gender], year, conc, family,
      accords: list(accords), top: list(top), heart: list(mid), base: list(base),
      longevity: lon, sillage: sil, popularity: pop,
    });
  }

  // ---------- Designer · masculine ----------
  F("Sauvage", "Dior", "D", "France", "M", 2015, "EDT", "Fougère", "Fresh Spicy, Amber, Citrus, Aromatic, Fougère",
    "bergamot, pepper", "sichuan pepper, lavender, pink pepper, vetiver, patchouli, geranium, elemi", "ambroxan, cedar, labdanum", 4, 3, 5);
  F("Sauvage Elixir", "Dior", "D", "France", "M", 2021, "Parfum", "Spicy", "Spicy, Amber, Aromatic, Woody, Fresh Spicy",
    "cinnamon, nutmeg, cardamom, grapefruit", "lavender", "licorice, sandalwood, amber, patchouli, vetiver", 5, 4, 5);
  F("Dior Homme Intense", "Dior", "D", "France", "M", 2011, "EDP", "Powdery", "Powdery, Floral, Woody, Iris, Sweet",
    "lavender", "iris, ambrette, pear", "vetiver, cedar", 4, 3, 5);
  F("Fahrenheit", "Dior", "D", "France", "M", 1988, "EDT", "Leather", "Leather, Woody, Floral, Violet, Spicy",
    "nutmeg, lavender, cedar, mandarin, chamomile, bergamot, hawthorn, lemon",
    "violet leaf, carnation, honeysuckle, sandalwood, jasmine, lily-of-the-valley, rose",
    "leather, vetiver, musk, amber, patchouli, tonka bean", 4, 3, 4);
  F("Bleu de Chanel", "Chanel", "D", "France", "M", 2010, "EDT", "Woody", "Woody, Citrus, Aromatic, Fresh Spicy, Amber",
    "grapefruit, lemon, mint, pink pepper, bergamot, aldehydes, coriander", "ginger, nutmeg, jasmine, iso e super",
    "incense, vetiver, cedar, sandalwood, patchouli, labdanum, white musk", 3, 3, 5);
  F("Allure Homme Sport", "Chanel", "D", "France", "M", 2004, "EDT", "Citrus", "Citrus, Fresh, Woody, Aquatic, Amber",
    "orange, blood mandarin, sea notes, aldehydes", "pepper, neroli, cedar", "tonka bean, vanilla, white musk, amber, vetiver, elemi", 3, 2, 4);
  F("Acqua di Giò", "Giorgio Armani", "D", "Italy", "M", 1996, "EDT", "Aquatic", "Aquatic, Citrus, Fresh, Aromatic, Floral",
    "lime, lemon, bergamot, jasmine, orange, mandarin, neroli",
    "sea notes, calone, peach, freesia, hyacinth, cyclamen, violet, coriander, nutmeg, rose, rosemary",
    "white musk, cedar, oakmoss, patchouli, amber", 3, 2, 5);
  F("Acqua di Giò Profumo", "Giorgio Armani", "D", "Italy", "M", 2015, "Parfum", "Aquatic", "Aquatic, Aromatic, Citrus, Fresh Spicy, Incense",
    "sea notes, bergamot", "rosemary, sage, geranium", "incense, patchouli", 4, 3, 5);
  F("Armani Code", "Giorgio Armani", "D", "Italy", "M", 2004, "EDT", "Amber", "Amber, Spicy, Citrus, Leather, Tobacco",
    "lemon, bergamot", "star anise, olive blossom, guaiac wood", "leather, tonka bean, tobacco", 3, 2, 4);
  F("1 Million", "Paco Rabanne", "D", "Spain", "M", 2008, "EDT", "Spicy", "Spicy, Sweet, Leather, Amber, Woody",
    "grapefruit, mint, blood mandarin", "rose, cinnamon, spicy notes", "leather, woody notes, amber, patchouli", 4, 3, 5);
  F("Le Male", "Jean Paul Gaultier", "D", "France", "M", 1995, "EDT", "Fougère", "Fougère, Aromatic, Vanilla, Lavender, Amber",
    "mint, lavender, cardamom, artemisia, bergamot", "cinnamon, orange blossom, cumin",
    "vanilla, tonka bean, amber, sandalwood, cedar", 4, 3, 5);
  F("Le Male Le Parfum", "Jean Paul Gaultier", "D", "France", "M", 2020, "EDP", "Amber", "Amber, Vanilla, Powdery, Lavender, Woody",
    "cardamom", "lavender, iris", "vanilla, woody notes", 4, 3, 5);
  F("Ultra Male", "Jean Paul Gaultier", "D", "France", "M", 2015, "EDT", "Gourmand", "Gourmand, Vanilla, Fruity, Lavender, Amber",
    "pear, lavender, mint, bergamot, lemon", "cinnamon, clary sage, caraway", "vanilla, amber, patchouli, cedar", 4, 4, 5);
  F("Y Eau de Parfum", "Yves Saint Laurent", "D", "France", "M", 2018, "EDP", "Fougère", "Fougère, Aromatic, Fresh, Woody, Fruity",
    "apple, ginger, bergamot", "sage, juniper berries, geranium", "amberwood, tonka bean, cedar, vetiver, olibanum", 4, 3, 5);
  F("La Nuit de l'Homme", "Yves Saint Laurent", "D", "France", "M", 2009, "EDT", "Spicy", "Spicy, Aromatic, Lavender, Woody, Fresh Spicy",
    "cardamom", "lavender, cedar, bergamot", "vetiver, caraway", 2, 2, 5);
  F("Eros", "Versace", "D", "Italy", "M", 2012, "EDT", "Fougère", "Fougère, Vanilla, Fresh, Aromatic, Sweet",
    "mint, green apple, lemon", "tonka bean, ambroxan, geranium", "vanilla, cedar, vetiver, oakmoss", 4, 4, 5);
  F("Dylan Blue", "Versace", "D", "Italy", "M", 2016, "EDT", "Fougère", "Fougère, Aquatic, Citrus, Aromatic, Woody",
    "bergamot, grapefruit, fig leaf, water notes", "violet leaf, papyrus, patchouli, black pepper, ambroxan",
    "musk, tonka bean, saffron, incense", 3, 3, 4);
  F("Luna Rossa Carbon", "Prada", "D", "Italy", "M", 2017, "EDT", "Aromatic", "Aromatic, Lavender, Fresh, Metallic, Citrus",
    "bergamot, pepper", "lavender, metallic notes, water notes", "ambroxan, patchouli, dry wood", 3, 3, 4);
  F("L'Homme", "Prada", "D", "Italy", "M", 2016, "EDT", "Powdery", "Powdery, Iris, Fresh Spicy, Woody, Floral",
    "neroli, black pepper, cardamom, carrot seeds", "iris, violet, geranium, mate", "amber, patchouli, cedar, sandalwood", 3, 2, 4);
  F("Terre d'Hermès", "Hermès", "D", "France", "M", 2006, "EDT", "Woody", "Woody, Citrus, Earthy, Mineral, Spicy",
    "orange, grapefruit", "pepper, pelargonium, flint", "vetiver, cedar, patchouli, benzoin", 4, 3, 5);
  F("Spicebomb", "Viktor & Rolf", "D", "Netherlands", "M", 2012, "EDT", "Spicy", "Spicy, Leather, Tobacco, Amber, Woody",
    "pink pepper, elemi, grapefruit, bergamot", "cinnamon, saffron, paprika", "leather, tobacco, vetiver", 4, 3, 4);
  F("Light Blue Pour Homme", "Dolce & Gabbana", "D", "Italy", "M", 2007, "EDT", "Citrus", "Citrus, Aromatic, Fresh, Woody, Aquatic",
    "grapefruit, bergamot, mandarin, juniper", "pepper, rosemary, rosewood", "musk, incense, oakmoss", 2, 2, 4);
  F("Boss Bottled", "Hugo Boss", "D", "Germany", "M", 1998, "EDT", "Woody", "Woody, Fruity, Spicy, Fresh Spicy, Sweet",
    "apple, plum, lemon, bergamot, oakmoss, geranium", "cinnamon, mahogany, carnation",
    "vanilla, sandalwood, cedar, vetiver, olive tree", 3, 2, 4);
  F("Cool Water", "Davidoff", "D", "Switzerland", "M", 1988, "EDT", "Aquatic", "Aquatic, Fresh, Aromatic, Lavender, Green",
    "sea water, lavender, mint, green notes, rosemary, calone, coriander", "sandalwood, neroli, jasmine, geranium",
    "musk, oakmoss, cedar, tobacco, amber", 3, 3, 4);
  F("L'Eau d'Issey Pour Homme", "Issey Miyake", "D", "Japan", "M", 1994, "EDT", "Citrus", "Citrus, Aquatic, Woody, Fresh Spicy, Aromatic",
    "yuzu, lemon, bergamot, mandarin, coriander, cypress, verbena, tarragon, sage",
    "nutmeg, lily, cinnamon, saffron, geranium, blue lotus", "vetiver, sandalwood, tobacco, cedar, musk, amber", 3, 3, 4);
  F("Explorer", "Montblanc", "D", "Germany", "M", 2019, "EDP", "Woody", "Woody, Earthy, Leather, Fresh Spicy, Citrus",
    "bergamot, pink pepper, clary sage", "vetiver, leather", "ambroxan, akigalawood, patchouli", 3, 3, 4);
  F("A*Men", "Mugler", "D", "France", "M", 1996, "EDT", "Gourmand", "Gourmand, Coffee, Caramel, Patchouli, Lavender",
    "lavender, mint, bergamot, coriander", "patchouli, honey, caramel, milk", "coffee, vanilla, tonka bean, tar, amber, musk", 5, 4, 4);
  F("Noir Extreme", "Tom Ford", "D", "USA", "M", 2015, "EDP", "Amber", "Amber, Gourmand, Spicy, Vanilla, Woody",
    "cardamom, nutmeg, saffron, mandarin", "kulfi, rose, jasmine, orange blossom", "vanilla, amber, sandalwood, woody notes", 4, 3, 4);
  F("Oud Wood", "Tom Ford", "D", "USA", "U", 2007, "EDP", "Oud", "Oud, Woody, Warm Spicy, Amber, Smoky",
    "rosewood, cardamom, chinese pepper", "oud, sandalwood, vetiver", "tonka bean, vanilla, amber", 3, 2, 5);
  F("Tobacco Vanille", "Tom Ford", "D", "USA", "U", 2007, "EDP", "Amber", "Amber, Tobacco, Vanilla, Gourmand, Spicy",
    "tobacco leaf, spicy notes", "vanilla, cacao, tonka bean, tobacco blossom", "dried fruits, woody notes", 5, 3, 5);
  F("Lost Cherry", "Tom Ford", "D", "USA", "U", 2018, "EDP", "Gourmand", "Gourmand, Fruity, Cherry, Almond, Sweet",
    "black cherry, cherry liqueur, bitter almond", "rose, jasmine sambac", "peru balsam, tonka bean, sandalwood, vetiver, cedar", 4, 3, 5);
  F("Ombré Leather", "Tom Ford", "D", "USA", "U", 2018, "EDP", "Leather", "Leather, Animalic, Woody, Patchouli, Floral",
    "cardamom", "leather, jasmine sambac", "amber, moss, patchouli", 4, 3, 5);
  F("Tuscan Leather", "Tom Ford", "D", "USA", "U", 2007, "EDP", "Leather", "Leather, Fruity, Smoky, Spicy, Animalic",
    "raspberry, saffron, thyme", "olibanum, jasmine", "leather, suede, amber, woody notes", 5, 3, 4);
  F("Neroli Portofino", "Tom Ford", "D", "USA", "U", 2011, "EDP", "Citrus", "Citrus, Floral, Aromatic, Fresh, Neroli",
    "bergamot, mandarin, lemon, lavender, myrtle, rosemary", "orange blossom, neroli, jasmine, pittosporum",
    "amber, angelica, ambrette", 2, 2, 4);
  F("Replica Jazz Club", "Maison Margiela", "D", "France", "M", 2013, "EDT", "Amber", "Amber, Tobacco, Boozy, Vanilla, Sweet",
    "pink pepper, neroli, lemon", "rum, vetiver, clary sage", "tobacco leaf, vanilla, styrax", 3, 2, 5);
  F("Replica By the Fireplace", "Maison Margiela", "D", "France", "U", 2015, "EDT", "Woody", "Woody, Smoky, Vanilla, Warm Spicy, Sweet",
    "pink pepper, orange blossom, clove", "chestnut, guaiac wood, juniper", "vanilla, peru balsam, cashmeran", 4, 3, 5);
  F("Replica Lazy Sunday Morning", "Maison Margiela", "D", "France", "U", 2013, "EDT", "Musk", "Musk, Floral, Powdery, Fresh, Fruity",
    "aldehydes, pear, lily-of-the-valley", "rose, iris, orange blossom", "white musk, ambrette, patchouli", 2, 2, 4);

  // ---------- Designer · feminine ----------
  F("N°5", "Chanel", "D", "France", "F", 1921, "EDP", "Floral", "Floral, Aldehydic, Powdery, Musk, Woody",
    "aldehydes, ylang-ylang, neroli, bergamot, peach, lemon", "iris, jasmine, rose, orris root, lily-of-the-valley",
    "civet, amber, sandalwood, musk, oakmoss, vanilla, vetiver, patchouli", 4, 3, 5);
  F("Coco Mademoiselle", "Chanel", "D", "France", "F", 2001, "EDP", "Chypre", "Chypre, Citrus, Patchouli, Floral, Musk",
    "orange, mandarin, bergamot, orange blossom", "rose, jasmine, mimosa, ylang-ylang",
    "patchouli, white musk, vanilla, vetiver, tonka bean, opoponax", 4, 3, 5);
  F("Chance Eau Tendre", "Chanel", "D", "France", "F", 2010, "EDT", "Fruity", "Fruity, Floral, Citrus, Musk, Fresh",
    "grapefruit, quince", "hyacinth, jasmine", "musk, iris, cedar, amber", 3, 2, 5);
  F("J'adore", "Dior", "D", "France", "F", 1999, "EDP", "Floral", "Floral, Fruity, White Floral, Sweet, Fresh",
    "pear, melon, magnolia, peach, mandarin, bergamot",
    "jasmine, lily-of-the-valley, tuberose, freesia, rose, orchid, plum, violet", "musk, vanilla, blackberry, cedar", 3, 3, 5);
  F("Miss Dior Blooming Bouquet", "Dior", "D", "France", "F", 2014, "EDT", "Floral", "Floral, Fruity, Rose, Fresh, Musk",
    "mandarin", "peony, damask rose, apricot, peach", "white musk", 2, 2, 5);
  F("Black Opium", "Yves Saint Laurent", "D", "France", "F", 2014, "EDP", "Gourmand", "Gourmand, Coffee, Vanilla, Sweet, White Floral",
    "pear, pink pepper, orange blossom", "coffee, jasmine, bitter almond, licorice", "vanilla, patchouli, cedar, cashmere wood", 4, 3, 5);
  F("Libre", "Yves Saint Laurent", "D", "France", "F", 2019, "EDP", "Amber", "Amber, Lavender, Vanilla, Floral, Citrus",
    "lavender, mandarin, black currant, petitgrain", "lavender, orange blossom, jasmine", "vanilla, musk, cedar, ambergris", 4, 3, 5);
  F("La Vie Est Belle", "Lancôme", "D", "France", "F", 2012, "EDP", "Gourmand", "Gourmand, Sweet, Vanilla, Fruity, Powdery",
    "black currant, pear", "iris, jasmine, orange blossom", "praline, vanilla, patchouli, tonka bean", 5, 4, 5);
  F("Lady Million", "Paco Rabanne", "D", "Spain", "F", 2010, "EDP", "Floral", "Floral, Honey, Fruity, White Floral, Sweet",
    "neroli, raspberry, lemon", "gardenia, orange blossom, jasmine", "honey, patchouli, amber", 4, 4, 4);
  F("Flowerbomb", "Viktor & Rolf", "D", "Netherlands", "F", 2005, "EDP", "Floral", "Floral, Sweet, Patchouli, Musk, Powdery",
    "tea, bergamot, osmanthus", "orchid, jasmine, rose, freesia, orange blossom", "patchouli, musk, vanilla", 4, 3, 5);
  F("Angel", "Mugler", "D", "France", "F", 1992, "EDP", "Gourmand", "Gourmand, Patchouli, Sweet, Caramel, Fruity",
    "cotton candy, coconut, cassia, melon, bergamot, mandarin", "honey, apricot, blackberry, plum, red berries, jasmine, rose",
    "patchouli, chocolate, caramel, vanilla, tonka bean, amber, musk", 5, 4, 4);
  F("Alien", "Mugler", "D", "France", "F", 2005, "EDP", "Floral", "Floral, White Floral, Woody, Amber, Animalic",
    "jasmine sambac", "cashmere wood", "amber", 5, 4, 5);
  F("Bloom", "Gucci", "D", "Italy", "F", 2017, "EDP", "Floral", "Floral, White Floral, Tuberose, Green, Powdery",
    "jasmine", "tuberose", "rangoon creeper", 3, 3, 4);
  F("Good Girl", "Carolina Herrera", "D", "USA", "F", 2016, "EDP", "Gourmand", "Gourmand, Amber, White Floral, Cacao, Sweet",
    "almond, coffee, bergamot, lemon", "tuberose, jasmine sambac, orange blossom, orris root, rose",
    "tonka bean, cacao, vanilla, praline, sandalwood, musk, amber, cinnamon, patchouli, cedar", 4, 3, 5);
  F("Sì", "Giorgio Armani", "D", "Italy", "F", 2013, "EDP", "Chypre", "Chypre, Fruity, Vanilla, Rose, Woody",
    "black currant", "rose, freesia", "vanilla, patchouli, ambroxan, woody notes", 4, 3, 5);
  F("Light Blue", "Dolce & Gabbana", "D", "Italy", "F", 2001, "EDT", "Citrus", "Citrus, Fruity, Fresh, Floral, Woody",
    "lemon, apple, cedar, bellflower", "bamboo, jasmine, white rose", "cedar, musk, amber", 2, 2, 5);
  F("Daisy", "Marc Jacobs", "D", "USA", "F", 2007, "EDT", "Floral", "Floral, Fruity, Violet, Fresh, Musk",
    "violet leaf, grapefruit, strawberry", "violet, gardenia, jasmine", "musk, white woods, vanilla", 2, 2, 5);
  F("Chloé", "Chloé", "D", "France", "F", 2008, "EDP", "Floral", "Floral, Rose, Powdery, Fresh, Fruity",
    "peony, litchi, freesia", "rose, lily-of-the-valley, magnolia", "cedar, amber", 3, 2, 4);
  F("Donna Born in Roma", "Valentino", "D", "Italy", "F", 2019, "EDP", "Amber", "Amber, Vanilla, White Floral, Fruity, Woody",
    "black currant, pink pepper, bergamot", "jasmine, jasmine sambac, jasmine tea", "vanilla, cashmeran, guaiac wood", 4, 3, 5);
  F("L'Interdit", "Givenchy", "D", "France", "F", 2018, "EDP", "Floral", "Floral, White Floral, Patchouli, Earthy, Sweet",
    "pear, bergamot", "tuberose, orange blossom, jasmine sambac", "vetiver, patchouli, ambroxan, vanilla", 4, 3, 4);
  F("Shalimar", "Guerlain", "D", "France", "F", 1925, "EDP", "Amber", "Amber, Vanilla, Powdery, Citrus, Smoky",
    "bergamot, lemon, mandarin", "iris, jasmine, rose, patchouli, vetiver",
    "vanilla, incense, leather, tonka bean, opoponax, civet, sandalwood, peru balsam", 4, 3, 4);
  F("Black Orchid", "Tom Ford", "D", "USA", "U", 2006, "EDP", "Amber", "Amber, Chocolate, Patchouli, Earthy, Floral",
    "truffle, gardenia, black currant, ylang-ylang, jasmine, bergamot, mandarin, lemon",
    "orchid, spices, lotus, fruity notes", "chocolate, patchouli, vanilla, incense, amber, sandalwood, vetiver, white musk", 5, 4, 5);
  F("CK One", "Calvin Klein", "D", "USA", "U", 1994, "EDT", "Citrus", "Citrus, Fresh, Green, Aromatic, Musk",
    "lemon, green notes, bergamot, pineapple, mandarin, cardamom, papaya",
    "lily-of-the-valley, jasmine, violet, nutmeg, rose, orris root, freesia",
    "green accord, musk, cedar, sandalwood, oakmoss, amber", 2, 2, 5);

  // ---------- Niche ----------
  F("Aventus", "Creed", "N", "France", "M", 2010, "EDP", "Chypre", "Chypre, Fruity, Smoky, Woody, Citrus",
    "pineapple, bergamot, black currant, apple", "birch, patchouli, jasmine, rose", "musk, oakmoss, ambergris, vanilla", 4, 3, 5);
  F("Green Irish Tweed", "Creed", "N", "France", "M", 1985, "EDP", "Green", "Green, Fresh, Violet, Woody, Aromatic",
    "lemon verbena, iris", "violet leaf", "ambergris, sandalwood", 4, 3, 4);
  F("Silver Mountain Water", "Creed", "N", "France", "U", 1995, "EDP", "Citrus", "Citrus, Fresh, Green, Tea, Musk",
    "bergamot, mandarin", "green tea, black currant", "musk, petitgrain, galbanum, sandalwood", 3, 2, 4);
  F("Baccarat Rouge 540", "Maison Francis Kurkdjian", "N", "France", "U", 2015, "EDP", "Amber", "Amber, Woody, Warm Spicy, Sweet, Floral",
    "saffron, jasmine", "amberwood, ambergris", "fir resin, cedar", 5, 4, 5);
  F("Grand Soir", "Maison Francis Kurkdjian", "N", "France", "U", 2016, "EDP", "Amber", "Amber, Balsamic, Vanilla, Sweet, Powdery",
    "labdanum", "benzoin, amber", "tonka bean, vanilla", 5, 3, 4);
  F("Santal 33", "Le Labo", "N", "USA", "U", 2011, "EDP", "Woody", "Woody, Leather, Iris, Smoky, Powdery",
    "violet, cardamom", "iris, ambroxan", "sandalwood, papyrus, cedar, leather", 4, 3, 5);
  F("Gypsy Water", "Byredo", "N", "Sweden", "U", 2008, "EDP", "Woody", "Woody, Citrus, Fresh Spicy, Vanilla, Conifer",
    "bergamot, lemon, pepper, juniper berries", "incense, pine needles, orris root", "amber, vanilla, sandalwood", 3, 2, 4);
  F("Mojave Ghost", "Byredo", "N", "Sweden", "U", 2014, "EDP", "Woody", "Woody, Musk, Floral, Fruity, Powdery",
    "ambrette, sapodilla", "magnolia, violet, sandalwood", "musk, cedar, ambergris", 3, 2, 4);
  F("Bal d'Afrique", "Byredo", "N", "Sweden", "U", 2009, "EDP", "Woody", "Woody, Citrus, Floral, Musk, Green",
    "bergamot, marigold, buchu", "violet, cyclamen", "vetiver, cedar", 3, 2, 4);
  F("Oud for Greatness", "Initio", "N", "France", "U", 2018, "EDP", "Oud", "Oud, Warm Spicy, Woody, Lavender, Saffron",
    "saffron, nutmeg, lavender", "oud", "patchouli, musk", 5, 4, 4);
  F("Layton", "Parfums de Marly", "N", "France", "M", 2016, "EDP", "Amber", "Amber, Fruity, Vanilla, Lavender, Warm Spicy",
    "apple, lavender, bergamot, mandarin", "geranium, violet, jasmine",
    "vanilla, cardamom, sandalwood, pepper, patchouli, guaiac wood", 4, 4, 5);
  F("Delina", "Parfums de Marly", "N", "France", "F", 2017, "EDP", "Floral", "Floral, Rose, Fruity, Musk, Fresh",
    "litchi, rhubarb, bergamot, nutmeg", "rose, peony, musk, vanilla", "cashmeran, incense, vetiver, cedar", 4, 3, 5);
  F("Herod", "Parfums de Marly", "N", "France", "M", 2012, "EDP", "Spicy", "Spicy, Tobacco, Vanilla, Smoky, Woody",
    "cinnamon, pepper", "tobacco leaf, osmanthus, incense, labdanum", "vanilla, iso e super, musk, cypriol, cedar", 4, 3, 4);
  F("Naxos", "Xerjoff", "N", "Italy", "U", 2015, "EDP", "Amber", "Amber, Honey, Tobacco, Lavender, Sweet",
    "lavender, bergamot, lemon", "honey, cinnamon, cashmeran, jasmine sambac", "tobacco leaf, tonka bean, vanilla", 5, 3, 4);
  F("Erba Pura", "Xerjoff", "N", "Italy", "U", 2019, "EDP", "Fruity", "Fruity, Citrus, Sweet, Musk, Vanilla",
    "orange, bergamot, lemon", "fruity notes", "white musk, vanilla, amber", 5, 4, 4);
  F("Love, Don't Be Shy", "Kilian", "N", "France", "U", 2007, "EDP", "Gourmand", "Gourmand, Sweet, Floral, Vanilla, Caramel",
    "neroli, bergamot, pink pepper, coriander", "orange blossom, honeysuckle, jasmine, iris, rose",
    "marshmallow, caramel, vanilla, sugar, musk, labdanum, civet", 4, 3, 4);
  F("Angels' Share", "Kilian", "N", "France", "U", 2020, "EDP", "Gourmand", "Gourmand, Boozy, Cinnamon, Vanilla, Sweet",
    "cognac", "cinnamon, tonka bean, oak", "praline, vanilla, sandalwood", 4, 3, 5);
  F("Interlude Man", "Amouage", "N", "Oman", "M", 2012, "EDP", "Amber", "Amber, Smoky, Incense, Leather, Oud",
    "oregano, pimento, bergamot", "amber, incense, opoponax, labdanum", "leather, oud, patchouli, sandalwood", 5, 4, 4);
  F("Reflection Man", "Amouage", "N", "Oman", "M", 2007, "EDP", "Floral", "Floral, Powdery, Woody, Fresh Spicy, White Floral",
    "rosemary, pepper, petitgrain", "jasmine, neroli, orris root, ylang-ylang", "sandalwood, cedar, vetiver, patchouli", 4, 3, 4);
  F("Philosykos", "Diptyque", "N", "France", "U", 1996, "EDT", "Green", "Green, Fig, Woody, Milky, Fresh",
    "fig", "fig leaf", "fig tree", 3, 2, 4);
  F("Hacivat", "Nishane", "N", "Turkey", "U", 2017, "Extrait", "Chypre", "Chypre, Fruity, Woody, Citrus, Mossy",
    "pineapple, grapefruit, bergamot", "patchouli, cedar, jasmine", "oakmoss, woody notes", 5, 4, 4);
  F("Portrait of a Lady", "Frédéric Malle", "N", "France", "F", 2010, "EDP", "Amber", "Amber, Rose, Patchouli, Warm Spicy, Incense",
    "raspberry, clove, cinnamon, black currant", "rose, patchouli", "incense, sandalwood, musk, amber, benzoin", 5, 4, 4);
  F("Molecule 01", "Escentric Molecules", "N", "Germany", "U", 2006, "EDT", "Woody", "Woody, Musk, Powdery, Fresh, Velvety",
    "", "iso e super", "", 3, 1, 4);
  F("Not a Perfume", "Juliette Has a Gun", "N", "France", "U", 2010, "EDP", "Musk", "Musk, Woody, Ambery, Clean, Fresh",
    "", "ambroxan", "", 3, 2, 3);
  F("Cedrat Boisé", "Mancera", "N", "France", "U", 2011, "EDP", "Woody", "Woody, Citrus, Fruity, Leather, Fresh",
    "lemon, black currant, spicy notes, bergamot", "fruity notes, water jasmine, patchouli",
    "leather, sandalwood, oakmoss, white musk, vanilla, cedar", 5, 4, 4);
  F("Intense Cafe", "Montale", "N", "France", "U", 2013, "EDP", "Gourmand", "Gourmand, Coffee, Rose, Vanilla, Amber",
    "floral notes", "rose, coffee", "vanilla, white musk, amber", 5, 4, 4);
  F("Wood Sage & Sea Salt", "Jo Malone", "N", "United Kingdom", "U", 2014, "EDC", "Aquatic", "Aquatic, Salty, Aromatic, Woody, Fresh",
    "", "sea salt, sage, grapefruit, ambrette, seaweed", "", 2, 2, 4);
  F("English Pear & Freesia", "Jo Malone", "N", "United Kingdom", "F", 2010, "EDC", "Fruity", "Fruity, Floral, Fresh, Musk, Sweet",
    "pear, melon", "freesia, rose", "patchouli, rhubarb, white musk, amber", 2, 2, 4);
  F("Vanilla 28", "Kayali", "N", "UAE", "U", 2018, "EDP", "Gourmand", "Gourmand, Vanilla, Sweet, Amber, Musk",
    "vanilla orchid, jasmine", "brown sugar, tonka bean", "amber, amberwood, musk, patchouli", 4, 3, 4);

  // ---------- Arabian ----------
  F("Khamrah", "Lattafa", "A", "UAE", "U", 2022, "EDP", "Gourmand", "Gourmand, Warm Spicy, Sweet, Cinnamon, Boozy",
    "cinnamon, nutmeg, bergamot", "dates, praline, tuberose, mahonial",
    "vanilla, tonka bean, amberwood, myrrh, benzoin, akigalawood", 5, 4, 5);
  F("Asad", "Lattafa", "A", "UAE", "M", 2021, "EDP", "Amber", "Amber, Warm Spicy, Tobacco, Vanilla, Coffee",
    "black pepper, pineapple, tobacco", "coffee, patchouli, iris", "vanilla, amber, dry wood, benzoin, labdanum", 5, 4, 5);
  F("Yara", "Lattafa", "A", "UAE", "F", 2020, "EDP", "Gourmand", "Gourmand, Sweet, Vanilla, Fruity, Powdery",
    "heliotrope, orchid, tangerine", "gourmand accord, tropical fruits", "vanilla, musk, sandalwood", 4, 3, 5);
  F("Badee Al Oud Oud for Glory", "Lattafa", "A", "UAE", "U", 2020, "EDP", "Oud", "Oud, Warm Spicy, Saffron, Woody, Lavender",
    "saffron, nutmeg, lavender", "oud, patchouli", "musk", 5, 4, 4);
  F("Club de Nuit Intense Man", "Armaf", "A", "UAE", "M", 2015, "EDT", "Chypre", "Chypre, Fruity, Smoky, Citrus, Woody",
    "lemon, pineapple, bergamot, black currant, apple", "birch, jasmine, rose", "musk, ambergris, patchouli, vanilla", 5, 4, 5);
  F("Hawas for Him", "Rasasi", "A", "UAE", "M", 2015, "EDP", "Aquatic", "Aquatic, Fruity, Fresh, Sweet, Warm Spicy",
    "apple, bergamot, lemon, cinnamon", "water notes, plum, orange blossom, cardamom", "ambergris, musk, patchouli, driftwood", 5, 4, 4);
  F("9 PM", "Afnan", "A", "UAE", "M", 2020, "EDP", "Amber", "Amber, Vanilla, Sweet, Fruity, Lavender",
    "apple, cinnamon, lavender, bergamot", "orange blossom, lily-of-the-valley", "vanilla, tonka bean, amber, patchouli", 5, 4, 5);

  // ---------- Celebrity & indie ----------
  F("Cloud", "Ariana Grande", "C", "USA", "F", 2018, "EDP", "Gourmand", "Gourmand, Sweet, Vanilla, Coconut, Lavender",
    "lavender, pear, bergamot", "whipped cream, praline, coconut, vanilla orchid", "musk, woody notes", 4, 3, 5);
  F("Fantasy", "Britney Spears", "C", "USA", "F", 2005, "EDP", "Gourmand", "Gourmand, Fruity, Sweet, Chocolate, Floral",
    "kiwi, lychee, quince", "white chocolate, cupcake, jasmine, orchid", "musk, woody notes, orris root", 3, 3, 4);
  F("Eilish", "Billie Eilish", "C", "USA", "F", 2021, "EDP", "Amber", "Amber, Vanilla, Sweet, Cacao, Fruity",
    "sugar, red berries, mandarin", "vanilla, cacao, spicy notes, rose", "tonka bean, amber, musk, woody notes", 4, 3, 4);
  F("You", "Glossier", "I", "USA", "U", 2017, "EDP", "Musk", "Musk, Powdery, Woody, Iris, Clean",
    "pink pepper", "iris, ambrette", "ambroxan, musk", 2, 1, 3);

  // Bottles fetched with scripts/fetch-fragrantica.mjs override or extend the list.
  // Fragrantica image ids (fimgs.net/mdimg/perfume/375x500.<id>.jpg), each checked by eye.
  const IMG = {"dior-sauvage":"31861", "dior-sauvage-elixir":"68415", "dior-dior-homme-intense":"13016", "dior-fahrenheit":"228", "chanel-bleu-de-chanel":"9099", "chanel-allure-homme-sport":"607", "giorgio-armani-acqua-di-gi":"410", "giorgio-armani-acqua-di-gi-profumo":"29727", "giorgio-armani-armani-code":"412", "paco-rabanne-1-million":"3747", "jean-paul-gaultier-le-male":"430", "jean-paul-gaultier-le-male-le-parfum":"61856", "jean-paul-gaultier-ultra-male":"30947", "yves-saint-laurent-y-eau-de-parfum":"50757", "yves-saint-laurent-la-nuit-de-l-homme":"5521", "versace-eros":"16657", "versace-dylan-blue":"40031", "prada-luna-rossa-carbon":"43402", "prada-l-homme":"39029", "herm-s-terre-d-herm-s":"17", "viktor-rolf-spicebomb":"13857", "dolce-gabbana-light-blue-pour-homme":"1068", "hugo-boss-boss-bottled":"383", "davidoff-cool-water":"507", "issey-miyake-l-eau-d-issey-pour-homme":"721", "montblanc-explorer":"52002", "mugler-a-men":"705", "tom-ford-noir-extreme":"29675", "tom-ford-oud-wood":"1826", "tom-ford-tobacco-vanille":"1825", "tom-ford-lost-cherry":"51411", "tom-ford-ombr-leather":"50239", "tom-ford-tuscan-leather":"1849", "tom-ford-neroli-portofino":"12192", "maison-margiela-replica-jazz-club":"20541", "maison-margiela-replica-by-the-fireplace":"31623", "maison-margiela-replica-lazy-sunday-morning":"20542", "chanel-n-5":"40069", "chanel-coco-mademoiselle":"611", "chanel-chance-eau-tendre":"8069", "dior-j-adore":"210", "dior-miss-dior-blooming-bouquet":"23280", "yves-saint-laurent-black-opium":"25324", "yves-saint-laurent-libre":"56077", "lanc-me-la-vie-est-belle":"14982", "paco-rabanne-lady-million":"9045", "viktor-rolf-flowerbomb":"1460", "mugler-angel":"704", "mugler-alien":"707", "gucci-bloom":"44894", "carolina-herrera-good-girl":"39681", "giorgio-armani-s":"18453", "dolce-gabbana-light-blue":"485", "marc-jacobs-daisy":"1361", "chlo-chlo":"1733", "valentino-donna-born-in-roma":"55805", "givenchy-l-interdit":"51488", "guerlain-shalimar":"53", "tom-ford-black-orchid":"1018", "calvin-klein-ck-one":"276", "creed-aventus":"9828", "creed-green-irish-tweed":"474", "creed-silver-mountain-water":"472", "maison-francis-kurkdjian-baccarat-rouge-540":"33519", "maison-francis-kurkdjian-grand-soir":"40816", "le-labo-santal-33":"12201", "byredo-gypsy-water":"3575", "byredo-mojave-ghost":"27040", "byredo-bal-d-afrique":"6458", "initio-oud-for-greatness":"53641", "parfums-de-marly-layton":"39314", "parfums-de-marly-delina":"43871", "parfums-de-marly-herod":"16939", "xerjoff-naxos":"30529", "xerjoff-erba-pura":"55157", "kilian-love-don-t-be-shy":"4322", "kilian-angels-share":"62615", "amouage-interlude-man":"15294", "amouage-reflection-man":"920", "diptyque-philosykos":"72040", "nishane-hacivat":"44174", "fr-d-ric-malle-portrait-of-a-lady":"10464", "escentric-molecules-molecule-01":"845", "juliette-has-a-gun-not-a-perfume":"10296", "mancera-cedrat-bois":"15211", "montale-intense-cafe":"18021", "jo-malone-wood-sage-sea-salt":"25529", "jo-malone-english-pear-freesia":"10314", "kayali-vanilla-28":"52616", "lattafa-khamrah":"75805", "lattafa-asad":"72821", "lattafa-yara":"76880", "lattafa-badee-al-oud-oud-for-glory":"64948", "armaf-club-de-nuit-intense-man":"34696", "rasasi-hawas-for-him":"46890", "afnan-9-pm":"65414", "ariana-grande-cloud":"50384", "britney-spears-fantasy":"600", "billie-eilish-eilish":"70052", "glossier-you":"46885"};
  rows.forEach((r) => { if (IMG[r.id]) r.img = Number(IMG[r.id]); });

  window.FRAGRANCES = rows;
  window.mergeExtraFragrances = function (extra) {
    (extra || []).forEach((f) => {
      const i = rows.findIndex((r) => r.id === f.id);
      if (i >= 0) rows[i] = { ...rows[i], ...f }; else rows.push(f);
    });
  };
})();
