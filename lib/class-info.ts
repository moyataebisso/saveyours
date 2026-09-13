// Prices here must match the classes table in Supabase. Supabase is
// authoritative for checkout — this file only controls what's displayed. If
// they drift, customers see one price and get charged another.
//
// dbType matches classes.type in Supabase and drives session filtering for
// each class page. dbName is the Red Cross course code and is shown as body
// text on the class landing page (never in the H1).

export interface ClassInfo {
  slug: string
  dbType: string
  dbName: string
  displayName: string
  audience: string
  price: number
  certValidYears: number
  maxStudents: number
  summary: string
  whoFor: string[]
  whatYouLearn: string[]
}

export const CLASS_INFO: readonly ClassInfo[] = [
  {
    slug: 'bls',
    dbType: 'BLS',
    dbName: 'Blended Basic Life Support-BL r.25',
    displayName: 'Basic Life Support (BLS)',
    audience: 'Healthcare professionals',
    price: 75,
    certValidYears: 2,
    maxStudents: 12,
    summary:
      'Red Cross BLS certification for healthcare professionals whose license or employer requires it. Blended format — online portion first, then an in-person skills check in Bloomington, MN.',
    whoFor: [
      'Nurses and nursing students',
      'CNAs and medical assistants',
      'EMS, paramedics, and firefighters',
      'Dental and allied-health professionals',
      'Anyone whose license or employer requires BLS',
    ],
    whatYouLearn: [
      'High-quality single-rescuer CPR for adults, children, and infants',
      'Two-rescuer CPR and team-based resuscitation',
      'AED use in adult and pediatric emergencies',
      'Bag-mask ventilation technique',
      'Choking response for responsive and unresponsive patients',
    ],
  },
  {
    slug: 'adult-pediatric-first-aid-cpr-aed',
    dbType: 'CPR_AED',
    dbName: 'Blended Adult and Pediatric First Aid/CPR/AED-BL-r.21',
    displayName: 'Adult and Pediatric First Aid/CPR/AED',
    audience: 'General public',
    price: 90,
    certValidYears: 2,
    maxStudents: 12,
    summary:
      'Red Cross First Aid/CPR/AED certification that covers adults, children, and infants — for anyone responsible for kids as well as adults. Blended format in Bloomington, MN.',
    whoFor: [
      'Childcare providers and preschool staff',
      'Teachers, coaches, and camp counselors',
      'Parents, grandparents, and babysitters',
      'Youth-sports volunteers and school nurses',
      'Anyone working with both adults and children',
    ],
    whatYouLearn: [
      'Adult, child, and infant CPR',
      'AED use across all age groups',
      'Choking response for adults, children, and infants',
      'First aid for common injuries — bleeding, burns, sprains, and shock',
      'Recognition and response for medical emergencies like seizures and allergic reactions',
    ],
  },
  {
    slug: 'adult-first-aid-cpr-aed',
    dbType: 'Adult First Aid/CPR/AED',
    dbName: 'Blended Adult First Aid/CPR/AED-BL-r.21',
    displayName: 'Adult First Aid/CPR/AED',
    audience: 'General public',
    price: 100,
    certValidYears: 2,
    maxStudents: 12,
    summary:
      'Red Cross First Aid/CPR/AED certification focused on adults — for workplace responders and anyone whose role requires CPR without pediatric coverage. Blended format in Bloomington, MN.',
    whoFor: [
      'Workplace first-aid responders',
      'Personal trainers and gym staff',
      'Security personnel and event staff',
      'Contractors and construction crews',
      'Anyone needing adult-only CPR certification for work',
    ],
    whatYouLearn: [
      'Adult CPR technique for hands-on and hands-only response',
      'AED use in adult cardiac emergencies',
      'Choking response for responsive and unresponsive adults',
      'First aid for bleeding, burns, sprains, fractures, and shock',
      'Recognition and response for cardiac, stroke, and diabetic emergencies',
    ],
  },
]

export function getClassBySlug(slug: string): ClassInfo | undefined {
  return CLASS_INFO.find((c) => c.slug === slug)
}
