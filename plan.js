// ===== CONTENT FILE – everything on the site comes from here =====
// Source: "PPSSD Multi-Year Plan" (Plant Product Safety Services Division).
// To extend the plan, add another entry to `years` (e.g. 2031) – the year slider,
// map, counters and panels all update automatically.
// Amounts are in millions of pesos (₱M), as shown in the source slides.
window.PLAN = {
  title: "Multi-Year Plan for the Expansion of Regulatory Capabilities",
  division: "Plant Product Safety Services Division",
  divisionShort: "PPSSD",
  source: "PPSSD Multi-Year Plan",

  // ---- Slide 1: Critical Food Safety Issues ----
  issuesTitle: "Critical food safety issues",
  issuesSubtitle: "Fresh and minimally processed plant foods",
  issues: [
    { n: 1, title: "Emergency Preparedness", text: "Need to establish a rapid response network to prepare for outbreaks.", tags: [] },
    { n: 2, title: "Emerging Hazards", text: "", tags: ["Emerging Contaminants", "Anti-Microbial Resistance", "Pollutants"] },
    { n: 3, title: "Food Fraud and Agricultural Economic Sabotage", text: "", tags: ["Smuggling", "Hoarding", "Profiteering", "Cartel", "Food fraud"] },
    { n: 4, title: "Market Demand", text: "Compliance to food safety requirements of importing countries.", tags: [] }
  ],

  // ---- Slide 2: the five pillars ----
  pillars: [
    { n: 1, title: "PPSSD Office & Laboratories", text: "Regions with a PPSSD office and laboratories:",
      tags: ["I", "II", "III", "IV-A", "IV-B", "V", "VI", "VIII", "IX", "XII", "XIII", "NIR"],
      regions: ["ilocos", "cagayan", "central-luzon", "calabarzon", "mimaropa", "bicol", "western-visayas", "eastern-visayas", "zamboanga", "soccsksargen", "caraga", "nir"],
      mapNote: "Regions I, II, III, IV-A, IV-B, V, VI, VIII, IX, XII, XIII and NIR." },
    { n: 2, title: "Scope of Lab Analysis", text: "What the laboratories test for:",
      tags: ["Pesticide Residues", "Mycotoxins", "Heavy Metals", "Micro Contaminants", "Food quality"] },
    { n: 3, title: "Regulatory Services", text: "Core regulatory functions:",
      tags: ["Inspection", "Licensing", "Certification", "Monitoring", "Surveillance"] },
    { n: 4, title: "Risk-Based Regulations", text: "Forward-looking, risk-driven tools:",
      tags: ["Horizon Scanning (Forecasting)", "Risk Modelling"] },
    { n: 5, title: "Rapid Testing", text: "Testing close to where it is needed:",
      tags: ["Mobile Lab (Luzon, Visayas, Mindanao)", "BioSAFE Laboratories (ports)"],
      regions: "all",
      mapNote: "The Mobile Lab covers Luzon, Visayas and Mindanao. BioSAFE Laboratories are located at ports." }
  ],

  // ---- Regions (ids match geo.js) ----
  // code = how the plan labels the region's Center for PPUSQS
  regions: {
    "ilocos":            { name: "Region I – Ilocos Region",                   code: "Region 1",  group: "Luzon" },
    "car":               { name: "Cordillera Administrative Region (CAR)",      code: "CAR",       group: "Luzon" },
    "cagayan":           { name: "Region II – Cagayan Valley",                 code: "Region 2",  group: "Luzon" },
    "central-luzon":     { name: "Region III – Central Luzon",                 code: "Region 3",  group: "Luzon" },
    "ncr":               { name: "National Capital Region (NCR)",               code: "NCR",       group: "Luzon" },
    "calabarzon":        { name: "Region IV-A – CALABARZON",                   code: "Region 4A", group: "Luzon" },
    "mimaropa":          { name: "Region IV-B – MIMAROPA",                     code: "Region 4B", group: "Luzon" },
    "bicol":             { name: "Region V – Bicol Region",                    code: "Region 5",  group: "Luzon" },
    "western-visayas":   { name: "Region VI – Western Visayas",                code: "Region 6",  group: "Visayas" },
    "central-visayas":   { name: "Region VII – Central Visayas",               code: "Region 7",  group: "Visayas" },
    "nir":               { name: "Negros Island Region (NIR)",                  code: "NIR",       group: "Visayas" },
    "eastern-visayas":   { name: "Region VIII – Eastern Visayas",              code: "Region 8",  group: "Visayas" },
    "zamboanga":         { name: "Region IX – Zamboanga Peninsula",            code: "Region 9",  group: "Mindanao" },
    "northern-mindanao": { name: "Region X – Northern Mindanao",               code: "Region 10", group: "Mindanao" },
    "davao":             { name: "Region XI – Davao Region",                   code: "Region 11", group: "Mindanao" },
    "soccsksargen":      { name: "Region XII – SOCCSKSARGEN",                  code: "Region 12", group: "Mindanao" },
    "caraga":            { name: "Region XIII – CARAGA",                       code: "Region 13", group: "Mindanao" },
    "barmm":             { name: "Bangsamoro Autonomous Region (BARMM)",        code: "BARMM",     group: "Mindanao" }
  },

  // ---- Main facilities (always shown) ----
  facilities: [
    { id: "spal-baguio", name: "SPAL Baguio",  place: "Baguio City",         lat: 16.4023, lon: 120.5960, region: "car",               side: "left" },
    { id: "pals-cls",    name: "PALS + CLS",   place: "Quezon City",         lat: 14.6760, lon: 121.0437, region: "ncr",               side: "left" },
    { id: "spal-cebu",   name: "SPAL Cebu",    place: "Cebu City",           lat: 10.3157, lon: 123.8854, region: "central-visayas",   side: "right" },
    { id: "spal-cdo",    name: "SPAL CDO",     place: "Cagayan de Oro City", lat: 8.4542,  lon: 124.6319, region: "northern-mindanao", side: "left" },
    { id: "spal-davao",  name: "SPAL Davao",   place: "Davao City",          lat: 7.1907,  lon: 125.4553, region: "davao",             side: "right" }
  ],

  // ---- The roadmap: one entry per year ----
  // centers: regions that get a Center for PPUSQS in that year (cumulative on the map)
  years: [
    {
      year: 2026, label: "Expansion Plan", kind: "Expansion Plan",
      funding: { amount: 846, source: "UPLIFT program" },
      projects: [
        { name: "Construction of New PPSSD Regional Plant Biosafety Center", place: "Baguio City", cost: 80, type: "construction", lat: 16.4023, lon: 120.5960, region: "car" },
        { name: "Modernization and Upgrading of PPSSD Quezon City Laboratory", place: "Quezon City", cost: 35, type: "upgrading", lat: 14.6760, lon: 121.0437, region: "ncr" },
        { name: "Extension of PPSSD Regional Plant Biosafety Center", place: "Cagayan de Oro City", cost: 20, type: "upgrading", lat: 8.4542, lon: 124.6319, region: "northern-mindanao" },
        { name: "Construction of BPI Integrated Plant Biosafety Center", place: "CMU, Bukidnon", cost: 30, type: "construction", lat: 7.8561, lon: 125.0517, region: "northern-mindanao" },
        { name: "Construction of New PPSSD Regional Plant Biosafety Center", place: "Koronadal, South Cotabato", cost: 120, type: "construction", lat: 6.5031, lon: 124.8469, region: "soccsksargen" },
        { name: "Construction of New PPSSD Regional Plant Biosafety Center", place: "Clark, Pampanga", cost: 100, type: "construction", lat: 15.1860, lon: 120.5600, region: "central-luzon" }
      ],
      centers: []
    },
    {
      year: 2027, label: "Capacitation", kind: "Capacitation of Existing PPSSD Laboratories",
      funding: { amount: 770, source: "PSAT program" },
      capacitation: ["pals-cls", "spal-baguio", "spal-cebu", "spal-cdo", "spal-davao"],
      centers: ["car", "central-luzon", "central-visayas", "northern-mindanao", "davao", "soccsksargen"]
    },
    { year: 2028, label: "New centers", kind: "New Centers for PPUSQS", centers: ["cagayan", "bicol"] },
    { year: 2029, label: "New centers", kind: "New Centers for PPUSQS", centers: ["ilocos", "calabarzon", "western-visayas", "zamboanga"] },
    { year: 2030, label: "New centers", kind: "New Centers for PPUSQS", centers: ["mimaropa", "eastern-visayas", "nir", "caraga"] }
  ]
};
