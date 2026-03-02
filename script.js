
const burger = document.getElementById("burger");
const sidebar = document.getElementById("sidebar");

burger.addEventListener("click", () => {
sidebar.classList.toggle("active");
burger.classList.toggle("active");
});
