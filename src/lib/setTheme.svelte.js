export function setTheme(theme = "light") {
  localStorage.setItem('theme', theme)
  document.documentElement.classList.toggle("dark", theme === "dark");
}