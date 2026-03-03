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
function openStaffProfile(name, role, phone, commission, revenue, status) {

  document.getElementById("staffName").innerText = name;
  document.getElementById("staffRole").innerText = role;
  document.getElementById("staffPhone").innerText = phone;
  document.getElementById("staffCommission").innerText = commission;
  document.getElementById("staffRevenue").innerText = revenue;

  let commissionEarned = (revenue * commission / 100).toFixed(0);
  document.getElementById("commissionEarned").innerText = "₹" + commissionEarned;

  document.getElementById("staffPanel").classList.add("active");

  loadStaffChart();
}

function closeStaffPanel() {
  document.getElementById("staffPanel").classList.remove("active");
}

let staffChart;

function loadStaffChart() {

  const ctx = document.getElementById('staffChart');

  if (!ctx) return;

  if (staffChart) staffChart.destroy();

  staffChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr'],
      datasets: [{
        label: 'Revenue',
        data: [12000, 15000, 11000, 18000],
        borderWidth: 2
      }]
    }
  });
}

function openStaffModal() {
  document.getElementById("addStaffModal").style.display = "block";
}

function closeStaffModal() {
  document.getElementById("addStaffModal").style.display = "none";
}

function addStaff() {

  let name = document.getElementById("newStaffName").value;
  let role = document.getElementById("newStaffRole").value;
  let phone = document.getElementById("newStaffPhone").value;
  let commission = document.getElementById("newStaffCommission").value;

  if(!name || !role || !phone || !commission) {
    alert("Fill all fields");
    return;
  }

  let table = document.getElementById("staffTable").getElementsByTagName('tbody')[0];

  let row = table.insertRow();

row.innerHTML = `
  <td>${name}</td>
  <td>${role}</td>
  <td>${phone}</td>
  <td>${commission}%</td>
  <td>₹0</td>
  <td><span class="status present">Present</span></td>
  <td>
    <button class="delete-btn" onclick="deleteStaff(event, this)">Delete</button>
  </td>
`;
  row.onclick = function() {
    openStaffProfile(name, role, phone, commission, 0, "Present");
  };

  closeStaffModal();
}
function deleteStaff(event, button) {

  event.stopPropagation(); // Prevent row click

  if(confirm("Are you sure you want to remove this staff member?")) {

    const row = button.closest("tr");

    // If profile panel is open, close it
    closeStaffPanel();

    row.remove();
  }
}