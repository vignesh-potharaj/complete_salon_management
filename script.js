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
/* ================= INVENTORY LOGIC ================= */

let inventoryHistory = {};

function openInvModal() {
  document.getElementById("inventoryModal").style.display = "block";
}

function closeInvModal() {
  document.getElementById("inventoryModal").style.display = "none";
}

function addInventory() {

  let name = invName.value;
  let category = invCategory.value;
  let stock = parseInt(invStock.value);
  let min = parseInt(invMin.value);
  let supplier = invSupplier.value;
  let phone = invPhone.value;
  let purchase = parseInt(invPurchase.value);
  let selling = parseInt(invSelling.value);

  if (!name || !category || !stock || !min || !supplier || !phone || !purchase || !selling) {
    alert("Fill all fields");
    return;
  }

  let table = document.querySelector("#inventoryTable tbody");
  let row = table.insertRow();

  renderRow(row, name, category, stock, min, supplier, phone, purchase, selling);

  addHistory(name, "Product Added", stock);
  updateInventoryStats();
  closeInvModal();
}

function renderRow(row, name, category, stock, min, supplier, phone, purchase, selling) {

  let reorder = stock < min ? (min - stock) : 0;
  let totalValue = stock * purchase;
  let profitPerUnit = selling - purchase;
  let statusClass = stock <= min ? "inv-low" : "inv-good";
  let statusText = stock <= min ? "Low" : "Good";

  row.innerHTML = `
    <td>${name}</td>
    <td>${category}</td>
    <td>${stock}</td>
    <td>${min}</td>
    <td>${reorder}</td>
    <td>${supplier}</td>
    <td>${phone}</td>
    <td>₹${purchase}</td>
    <td>₹${selling}</td>
    <td>₹${profitPerUnit}</td>
    <td>₹${totalValue}</td>
    <td><span class="${statusClass}">${statusText}</span></td>
    <td>
      <button class="inv-action-btn" onclick="changeStock(this,1)">+</button>
      <button class="inv-action-btn" onclick="changeStock(this,-1)">-</button>
      <button class="inv-action-btn" onclick="openHistory(this)">History</button>
      <button class="inv-action-btn" onclick="deleteRow(this)">Delete</button>
    </td>
  `;
}

function changeStock(button, delta) {

  let row = button.closest("tr");

  let name = row.cells[0].innerText;
  let stock = parseInt(row.cells[2].innerText) + delta;
  if (stock < 0) stock = 0;

  row.cells[2].innerText = stock;

  recalcRow(row);
  addHistory(name, delta > 0 ? "Stock Increased" : "Stock Decreased", 1);
}

function recalcRow(row) {

  let stock = parseInt(row.cells[2].innerText);
  let min = parseInt(row.cells[3].innerText);
  let purchase = parseInt(row.cells[7].innerText.replace("₹",""));
  let selling = parseInt(row.cells[8].innerText.replace("₹",""));

  let reorder = stock < min ? (min - stock) : 0;
  let totalValue = stock * purchase;
  let profitPerUnit = selling - purchase;

  row.cells[4].innerText = reorder;
  row.cells[9].innerText = "₹" + profitPerUnit;
  row.cells[10].innerText = "₹" + totalValue;

  let statusCell = row.cells[11].querySelector("span");

  if (stock <= min) {
    statusCell.className = "inv-low";
    statusCell.innerText = "Low";
  } else {
    statusCell.className = "inv-good";
    statusCell.innerText = "Good";
  }

  updateInventoryStats();
}

function deleteRow(button) {
  let row = button.closest("tr");
  let name = row.cells[0].innerText;
  addHistory(name, "Product Deleted", 0);
  row.remove();
  updateInventoryStats();
}

function updateInventoryStats() {

  let rows = document.querySelectorAll("#inventoryTable tbody tr");

  let totalProducts = rows.length;
  let lowStock = 0;
  let totalValue = 0;

  rows.forEach(row => {

    let stock = parseInt(row.cells[2].innerText);
    let min = parseInt(row.cells[3].innerText);

    // TOTAL VALUE COLUMN IS NOW INDEX 10
    let value = parseInt(row.cells[10].innerText.replace("₹",""));

    totalValue += value;

    if (stock <= min) {
      lowStock++;
    }
  });

  document.getElementById("invTotalProducts").innerText = totalProducts;
  document.getElementById("invLowStock").innerText = lowStock;
  document.getElementById("invTotalValue").innerText = "₹" + totalValue;
}

function addHistory(product, action, qty) {

  if (!inventoryHistory[product]) {
    inventoryHistory[product] = [];
  }

  inventoryHistory[product].push({
    date: new Date().toLocaleString(),
    action: action,
    qty: qty
  });
}

function openHistory(button) {

  let row = button.closest("tr");
  let product = row.cells[0].innerText;
  let history = inventoryHistory[product] || [];

  let html = history.length === 0
    ? "No history available."
    : history.map(h =>
        `<p><strong>${h.date}</strong><br>${h.action} (Qty: ${h.qty})</p><hr>`
      ).join("");

  inventoryHistoryContent.innerHTML = html;
  inventoryHistoryModal.style.display = "block";
}

function closeHistory() {
  inventoryHistoryModal.style.display = "none";
}

function exportInventory() {

  let rows = document.querySelectorAll("#inventoryTable tr");
  let csv = [];

  rows.forEach(row => {
    let cols = row.querySelectorAll("td, th");
    let rowData = [];
    cols.forEach(col => rowData.push(col.innerText));
    csv.push(rowData.join(","));
  });

  let blob = new Blob([csv.join("\n")], { type: "text/csv" });
  let link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "inventory_report.csv";
  link.click();
}
/* ================= DEMO DATA ================= */

function loadInventoryDemoData() {

  const demoProducts = [
    {
      name: "Keratin Serum Pro",
      category: "Hair Treatment",
      stock: 3,
      min: 6,
      supplier: "GlowCare Distributors",
      phone: "9876543210",
      purchase: 950,
      selling: 1200
    },
    {
      name: "Luxury Facial Cream",
      category: "Skin Care",
      stock: 12,
      min: 5,
      supplier: "Radiance Supplies",
      phone: "9123456780",
      purchase: 600,
      selling: 850
    },
    {
      name: "Professional Shampoo 5L",
      category: "Hair Care",
      stock: 7,
      min: 4,
      supplier: "StyleMart Wholesale",
      phone: "9988776655",
      purchase: 1200,
      selling: 1500
    },
    {
      name: "Beard Styling Oil",
      category: "Grooming",
      stock: 2,
      min: 5,
      supplier: "Urban Groom Co.",
      phone: "9012345678",
      purchase: 400,
      selling: 600
    }
  ];

  const table = document.querySelector("#inventoryTable tbody");

  demoProducts.forEach(product => {

    let row = table.insertRow();

    renderRow(
      row,
      product.name,
      product.category,
      product.stock,
      product.min,
      product.supplier,
      product.phone,
      product.purchase,
      product.selling
    );

    addHistory(product.name, "Initial Stock Loaded", product.stock);
  });

  updateInventoryStats();
}

window.addEventListener("DOMContentLoaded", loadInventoryDemoData);