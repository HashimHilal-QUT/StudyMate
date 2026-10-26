/* University names: Study Australia, retrieved 26 October 2026.
   https://www.studyaustralia.gov.au/en/plan-your-studies/list-of-australian-universities
   Local snapshot: no third-party request is needed when filling in a profile. */
const AUSTRALIAN_UNIVERSITIES = [
  'Adelaide University', 'Australian Catholic University', 'Australian University of Theology',
  'Australian National University', 'Avondale University', 'Bond University',
  'Charles Darwin University', 'Charles Sturt University', 'CQ University', 'Curtin University',
  'Deakin University', 'Edith Cowan University', 'Federation University of Australia',
  'Flinders University', 'Griffith University', 'James Cook University', 'La Trobe University',
  'Macquarie University', 'Monash University', 'Murdoch University', 'Queensland University of Technology',
  'RMIT University', 'Southern Cross University', 'Swinburne University of Technology',
  'Torrens University Australia', 'University of Canberra', 'University of Divinity',
  'University of Melbourne', 'University of New England', 'University of New South Wales',
  'University of Newcastle', 'University of Notre Dame Australia', 'University of Queensland',
  'University of Southern Queensland', 'University of Sydney', 'University of Tasmania',
  'University of Technology Sydney', 'University of the Sunshine Coast', 'University of Western Australia',
  'University of Wollongong', 'Victoria University', 'Western Sydney University',
].sort((a, b) => a.localeCompare(b));
const STUDENT_CITIES = ['Adelaide', 'Albury', 'Armidale', 'Ballarat', 'Bathurst', 'Bendigo',
  'Brisbane', 'Bunbury', 'Bundaberg', 'Cairns', 'Canberra', 'Darwin', 'Geelong', 'Gold Coast',
  'Hobart', 'Launceston', 'Melbourne', 'Newcastle', 'Perth', 'Rockhampton', 'Sunshine Coast',
  'Sydney', 'Toowoomba', 'Townsville', 'Wollongong'];

function initUniversityPickers() {
  for (const prefix of ['reg', 'edit']) {
    const select = document.getElementById(`${prefix}-university-select`);
    for (const name of AUSTRALIAN_UNIVERSITIES) select.add(new Option(name, name));
    select.add(new Option('Not listed? Enter your institution / team', 'other'));
    select.addEventListener('change', () => {
      const manual = document.getElementById(`${prefix}-university`);
      manual.hidden = select.value !== 'other';
      if (!manual.hidden) manual.focus();
    });
  }
  const cities = document.getElementById('city-options');
  STUDENT_CITIES.forEach(city => cities.appendChild(new Option(city, city)));
}
function selectedUniversity(prefix) {
  const select = document.getElementById(`${prefix}-university-select`);
  return select.value === 'other' ? document.getElementById(`${prefix}-university`).value.trim() : select.value;
}
function setUniversity(prefix, university) {
  const listed = AUSTRALIAN_UNIVERSITIES.includes(university);
  document.getElementById(`${prefix}-university-select`).value = listed ? university : university ? 'other' : '';
  const manual = document.getElementById(`${prefix}-university`);
  manual.value = listed ? '' : university || '';
  manual.hidden = listed || !university;
}
