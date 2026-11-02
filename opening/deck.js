const slides = Array.from(document.querySelectorAll(".slide"));
const count = document.getElementById("count");
let index = 0;
let fallTimer = 0;

function show(next) {
  clearTimeout(fallTimer);
  index = Math.max(0, Math.min(slides.length - 1, next));
  slides.forEach(function (slide, i) {
    slide.classList.toggle("on", i === index);
    slide.classList.remove("revealed");
    if (slide.dataset.steps) slide.dataset.step = slide.dataset.steps.split(",")[0];
  });
  dropHeading(slides[index]);
  // The opening slide sits before slide 0 and isn't counted.
  count.textContent = index === 0 ? "" : (index - 1) + " / " + (slides.length - 2);
  playSlide(slides[index]);
}

// Before its reveal, an intro slide's heading sits centered: push it down by
// half the height of whatever the reveal will show beneath it.
function dropHeading(slide) {
  const h1 = slide.querySelector(".intro h1");
  if (!h1) return;
  let below = 0;
  for (let el = h1.nextElementSibling; el; el = el.nextElementSibling) {
    const style = getComputedStyle(el);
    below += el.offsetHeight + parseFloat(style.marginTop) + parseFloat(style.marginBottom);
  }
  h1.style.setProperty("--drop", below / 2 + "px");
}

// A data-steps slide walks groups → matter → fall, then the balls leave and the next slide comes up.
// Other intro slides (data-hold) take one extra step forward to reveal their content.
function forward() {
  const slide = slides[index];
  const steps = slide.dataset.steps ? slide.dataset.steps.split(",") : null;
  if (steps) {
    const at = Math.max(0, steps.indexOf(slide.dataset.step || steps[0]));
    if (at < steps.length - 1) {
      const next = steps[at + 1];
      slide.dataset.step = next;
      if (next === "matter") {
        slide.classList.add("revealed");
        playSlide(slide);
      }
      if (next === "fall") startFall(slide);
      return;
    }
    clearTimeout(fallTimer);
  } else if (slide.hasAttribute("data-hold") && !slide.classList.contains("revealed")) {
    slide.classList.add("revealed");
    playSlide(slide);
    return;
  }
  show(index + 1);
}

function startFall(slide) {
  const canvas = slide.querySelector("canvas[data-demo='title']");
  if (canvas && typeof canvas.demoFall === "function") canvas.demoFall();
  clearTimeout(fallTimer);
  fallTimer = setTimeout(function () {
    if (slides[index] === slide) show(index + 1);
  }, 1700);
}

document.addEventListener("keydown", function (event) {
  if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
    event.preventDefault();
    forward();
  } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
    event.preventDefault();
    show(index - 1);
  } else if (event.key === "Home") {
    show(0);
  } else if (event.key === "End") {
    show(slides.length - 1);
  }
});

document.getElementById("deck").addEventListener("click", function (event) {
  if (event.target.closest("a, button")) return;
  const x = event.clientX / window.innerWidth;
  if (x > 0.5) forward(); else show(index - 1);
});

window.addEventListener("resize", function () { dropHeading(slides[index]); });
show(0);
