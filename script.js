function showSection(sectionId) {
  const sections = document.querySelectorAll(".section");

  sections.forEach(section => {
    section.style.display = "none";
  });

  document.getElementById(sectionId).style.display = "block";
}
const form = document.getElementById("appointmentForm");
const table = document.querySelector(".appointments-list table");

form.addEventListener("submit", function(e) {
  e.preventDefault();

  const name = form.children[0].value;
  const service = form.children[1].value;
  const time = form.children[2].value;

  const row = table.insertRow();
  row.innerHTML = `
    <td>${time}</td>
    <td>${name}</td>
    <td>${service}</td>
    <td>Upcoming</td>
  `;

  alert("Appointment Added Successfully!");
  form.reset();
});
