/**
 * Editable city alias map: alternative spelling → canonical active-city slug.
 *
 * Exports: `CITY_ALIASES`.
 * Notes:
 * - Keys are matched after normalisation (trim, lower-case, collapsed whitespace,
 *   spaces/underscores → "-"), so "Navi  Mumbai" and "navi_mumbai" match "navi-mumbai".
 * - Values must be slugs that exist in `lib/cities/active-cities.generated.ts`
 *   (a unit test enforces this).
 * - The OEM list uses older names as canonical (Bangalore, Gurgaon, New Delhi), so
 *   modern names are aliases here.
 */
export const CITY_ALIASES: Readonly<Record<string, string>> = {
  bengaluru: "bangalore",
  gurugram: "gurgaon",
  delhi: "new-delhi",
  bombay: "mumbai",
  poona: "pune",
  calcutta: "kolkata",
  madras: "chennai",
  mysore: "mysuru",
  mangaluru: "mangalore",
  belgaum: "belagavi",
  trivandrum: "thiruvananthapuram",
  cochin: "kochi",
  baroda: "vadodara",
  benares: "varanasi",
  allahabad: "prayagraj",
  hubballi: "hubli",
  tumakuru: "tumkur",
  puducherry: "pondicherry",
  calicut: "kozhikode",
  trichur: "thrissur",
  vizag: "visakhapatnam",
  trichy: "tiruchirappalli",
  nasik: "nashik",
  gulbarga: "kalaburagi",
  bellary: "ballari",
  bijapur: "vijayapura",
  shimoga: "shivamogga",
};
