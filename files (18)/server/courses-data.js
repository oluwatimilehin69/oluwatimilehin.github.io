/* Server-side source of truth for course content and pricing.
   The frontend fetches this via GET /api/courses — it never hardcodes
   prices itself, so a tampered client can't buy a course for less. */

const COURSES = [
  {
    slug: 'portrait-foundations',
    title: 'Foundations of Portrait Photography',
    level: 'Beginner',
    duration: '4 weeks',
    price: 35000,
    tagline: 'Camera settings, light and posing — the building blocks of a strong portrait.',
    modules: [
      { title: 'Seeing Light', lessons: ['Reading natural light', 'Window light setups', 'Golden hour basics'] },
      { title: 'Camera Fundamentals', lessons: ['Aperture, ISO & shutter for portraits', 'Focus & depth of field', 'Metering for skin tones'] },
      { title: 'Working With People', lessons: ['Directing a nervous subject', 'Posing hands & posture', 'Building a shot list'] }
    ]
  },
  {
    slug: 'off-camera-lighting',
    title: 'Off-Camera Lighting Essentials',
    level: 'Intermediate',
    duration: '3 weeks',
    price: 45000,
    tagline: 'Take control of light with speedlights and strobes, on location or in studio.',
    modules: [
      { title: 'Gear & Setup', lessons: ['Choosing your first strobe', 'Triggers & modifiers', 'Safety on location'] },
      { title: 'Lighting Patterns', lessons: ['Rembrandt & butterfly light', 'Two-light setups', 'Balancing flash with ambient'] },
      { title: 'Real Sessions', lessons: ['Lighting an outdoor portrait at noon', 'A simple one-light headshot setup'] }
    ]
  },
  {
    slug: 'wedding-storytelling',
    title: 'Wedding Day Storytelling',
    level: 'Intermediate',
    duration: '5 weeks',
    price: 60000,
    tagline: 'Cover a full wedding day with a clear shot list and a narrative eye.',
    modules: [
      { title: 'Before the Day', lessons: ['Building a timeline with the couple', 'Scouting the venue', 'Packing a two-body kit'] },
      { title: 'On the Day', lessons: ['Getting ready & details', 'Ceremony coverage without getting in the way', 'Reception & low light'] },
      { title: 'After the Day', lessons: ['Culling a full wedding fast', 'Sequencing the story in edit'] }
    ]
  },
  {
    slug: 'studio-to-business',
    title: 'Studio to Business: Pricing & Client Work',
    level: 'All levels',
    duration: '3 weeks',
    price: 40000,
    tagline: 'Turn sessions into a sustainable studio — pricing, contracts and client care.',
    modules: [
      { title: 'Pricing', lessons: ['Costing a session honestly', 'Building packages clients understand'] },
      { title: 'Booking & Contracts', lessons: ['A simple booking flow', 'What every contract needs'] },
      { title: 'Client Experience', lessons: ['Setting expectations before the shoot', 'Delivering galleries clients love'] }
    ]
  },
  {
    slug: 'lightroom-editing',
    title: 'Editing & Retouching in Lightroom',
    level: 'Beginner',
    duration: '2 weeks',
    price: 25000,
    tagline: 'A repeatable editing workflow, from import to a consistent finished look.',
    modules: [
      { title: 'Workflow', lessons: ['Import & culling', 'Building your own preset'] },
      { title: 'Skin & Retouching', lessons: ['Natural skin retouching', 'Dodge & burn basics'] },
      { title: 'Consistency', lessons: ['Editing a full gallery to match', 'Exporting for web & print'] }
    ]
  }
];

function findCourse(slug) {
  return COURSES.find(c => c.slug === slug) || null;
}

function totalLessons(course) {
  return course.modules.reduce((sum, m) => sum + m.lessons.length, 0);
}

module.exports = { COURSES, findCourse, totalLessons };
