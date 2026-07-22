// chart.js - SVG Stock Chart Renderer

/**
 * Draws an interactive SVG stock price chart.
 * @param {Array} points Array of {time, price} coordinates
 * @param {SVGElement} svg The SVG element to render into
 * @param {HTMLElement} tooltip The tooltip HTML element
 * @param {string} accent Color theme ("bull", "bear", or "neutral")
 */
function drawStockChart(points, svg, tooltip, accent = "neutral") {
  // Clear previous chart
  svg.innerHTML = '';
  
  if (!points || points.length < 2) {
    svg.style.display = 'none';
    return;
  }
  svg.style.display = 'block';

  // Constants
  const width = 760;
  const height = 240;
  const padX = 12;
  const padY = 20;

  // Extract prices and timestamps
  const prices = points.map(p => p.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1.0;

  // Theme Colors
  let strokeColor = "#3b82f6"; // Blue default
  let areaColorStart = "rgba(59, 130, 246, 0.22)";
  
  if (accent === "bull") {
    strokeColor = "#22c55e"; // Green
    areaColorStart = "rgba(34, 197, 94, 0.22)";
  } else if (accent === "bear") {
    strokeColor = "#ef4444"; // Red
    areaColorStart = "rgba(239, 68, 68, 0.22)";
  }

  // Define SVG gradients and filters
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const gradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
  gradient.setAttribute("id", "chart-area-grad");
  gradient.setAttribute("x1", "0");
  gradient.setAttribute("y1", "0");
  gradient.setAttribute("x2", "0");
  gradient.setAttribute("y2", "1");

  const stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
  stop1.setAttribute("offset", "0%");
  stop1.setAttribute("stop-color", areaColorStart);

  const stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
  stop2.setAttribute("offset", "100%");
  stop2.setAttribute("stop-color", "rgba(6, 7, 13, 0)");

  gradient.appendChild(stop1);
  gradient.appendChild(stop2);
  defs.appendChild(gradient);
  svg.appendChild(defs);

  // Add grid lines (horizontal)
  for (let percent of [0.25, 0.5, 0.75]) {
    const y = padY + (height - padY * 2) * percent;
    const gridLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    gridLine.setAttribute("x1", padX);
    gridLine.setAttribute("x2", width - padX);
    gridLine.setAttribute("y1", y);
    gridLine.setAttribute("y2", y);
    gridLine.setAttribute("stroke", "#1e2235");
    gridLine.setAttribute("stroke-width", "1");
    gridLine.setAttribute("stroke-dasharray", "4,4");
    svg.appendChild(gridLine);
  }

  // Calculate coordinates
  const stepX = (width - padX * 2) / (points.length - 1);
  const coords = points.map((p, index) => {
    const x = padX + index * stepX;
    const y = padY + (height - padY * 2) * (1 - (p.price - minPrice) / priceRange);
    return { x, y, point: p };
  });

  // Construct Paths
  let pathD = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  for (let i = 1; i < coords.length; i++) {
    pathD += ` L ${coords[i].x.toFixed(1)} ${coords[i].y.toFixed(1)}`;
  }

  const areaD = `${pathD} L ${coords[coords.length - 1].x.toFixed(1)} ${height - padY} L ${coords[0].x.toFixed(1)} ${height - padY} Z`;

  // Draw Area Path
  const areaPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  areaPath.setAttribute("d", areaD);
  areaPath.setAttribute("fill", "url(#chart-area-grad)");
  svg.appendChild(areaPath);

  // Draw Line Path
  const linePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  linePath.setAttribute("d", pathD);
  linePath.setAttribute("fill", "none");
  linePath.setAttribute("stroke", strokeColor);
  linePath.setAttribute("stroke-width", "2.5");
  linePath.setAttribute("stroke-linejoin", "round");
  linePath.setAttribute("stroke-linecap", "round");
  svg.appendChild(linePath);

  // Interactive tracking elements
  const trackerLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
  trackerLine.setAttribute("stroke", strokeColor);
  trackerLine.setAttribute("stroke-width", "1.5");
  trackerLine.setAttribute("stroke-dasharray", "3,3");
  trackerLine.setAttribute("opacity", "0.5");
  trackerLine.setAttribute("y1", padY);
  trackerLine.setAttribute("y2", height - padY);
  trackerLine.style.display = "none";
  svg.appendChild(trackerLine);

  const trackerDot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  trackerDot.setAttribute("r", "5");
  trackerDot.setAttribute("fill", strokeColor);
  trackerDot.setAttribute("stroke", "#06070d");
  trackerDot.setAttribute("stroke-width", "2");
  trackerDot.style.display = "none";
  svg.appendChild(trackerDot);

  // Mouse interactivity
  svg.addEventListener("mousemove", (event) => {
    const rect = svg.getBoundingClientRect();
    const clientX = event.clientX - rect.left;
    const ratio = clientX / rect.width;
    
    // Find closest index
    const index = Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1))));
    const activeCoord = coords[index];
    
    // Position Tracker Elements
    trackerLine.setAttribute("x1", activeCoord.x);
    trackerLine.setAttribute("x2", activeCoord.x);
    trackerDot.setAttribute("cx", activeCoord.x);
    trackerDot.setAttribute("cy", activeCoord.y);
    
    trackerLine.style.display = "block";
    trackerDot.style.display = "block";

    // Format Indian Rupees (₹) display
    const formattedPrice = "₹" + activeCoord.point.price.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    const date = new Date(activeCoord.point.time);
    const dateStr = date.toLocaleDateString("en-IN", { month: "short", day: "numeric" }) + ", " + 
                    date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

    // Show Tooltip
    tooltip.innerHTML = `
      <div style="color: var(--text-secondary); margin-bottom: 2px;">${dateStr}</div>
      <div class="ticker-font" style="font-weight: 700; color: var(--text-primary); font-size: 0.8rem;">${formattedPrice}</div>
    `;
    tooltip.classList.remove("hidden");

    // Position tooltip box
    const tooltipWidth = tooltip.offsetWidth;
    const percentWidth = activeCoord.x / width;
    let offsetLeft = (percentWidth * rect.width) + 15;
    if (percentWidth > 0.7) {
      offsetLeft = (percentWidth * rect.width) - tooltipWidth - 15;
    }
    
    tooltip.style.left = `${offsetLeft}px`;
    tooltip.style.top = `${((activeCoord.y / height) * rect.height) - 40}px`;
  });

  svg.addEventListener("mouseleave", () => {
    trackerLine.style.display = "none";
    trackerDot.style.display = "none";
    tooltip.classList.add("hidden");
  });
}
