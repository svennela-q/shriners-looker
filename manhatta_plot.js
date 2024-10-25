looker.plugins.visualizations.add({
  id: "manhattan_plot",
  label: "Manhattan Plot",
  options: {
    color_scheme: {
      type: "array",
      label: "Color Scheme",
      display: "colors",
      default: ["#1f77b4"]
    },
    threshold: {
      type: "number",
      label: "Significance Threshold",
      default: 2
    }
  },

  // Visualization initialization
  create: function(element, config) {
    // Load D3.js from CDN if not defined
    if (typeof d3 === 'undefined') {
      let script = document.createElement("script");
      script.src = "https://d3js.org/d3.v7.min.js"; // Load D3.js
      script.onload = () => {
        this.setupVisualization(element, config);
        this.d3Ready = true; // Indicate that D3.js has been loaded
      };
      document.head.appendChild(script);
    } else {
      this.d3Ready = true; // D3.js was already loaded
      this.setupVisualization(element, config);
    }
  },

  // Visualization setup after D3.js is loaded
  setupVisualization: function(element, config) {
    // Clear any previous content
    element.innerHTML = ``;

    // Define margins
    const margin = { top: 20, right: 30, bottom: 50, left: 70 };

    // Create SVG
    this._svg = d3.select(element)
      .append("svg")
      .attr("width", element.clientWidth)
      .attr("height", element.clientHeight);

    // Chart group
    this._chartGroup = this._svg.append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Store margins
    this._margin = margin;
  },

  // Rendering the visualization with Looker data
  updateAsync: function(data, element, config, queryResponse, details, done) {
    // Ensure D3.js is ready before rendering
    if (!this.d3Ready) {
      console.log("D3.js is not yet loaded. Retrying...");
      return;
    }

    // Validate that there are enough dimensions and measures
    if (!queryResponse.fields || !queryResponse.fields.dimensions || !queryResponse.fields.measures ||
        queryResponse.fields.dimensions.length < 2 || queryResponse.fields.measures.length < 1) {
      this.addError({
        title: "Insufficient Data",
        message: "This visualization requires at least two dimensions and one measure."
      });
      return;
    }

    // Clear any previous chart
    this._chartGroup.selectAll("*").remove();

    // Recalculate chart width and height
    const margin = this._margin;
    const width = element.clientWidth - margin.left - margin.right;
    const height = element.clientHeight - margin.top - margin.bottom;

    // Update SVG dimensions
    this._svg
      .attr("width", element.clientWidth)
      .attr("height", element.clientHeight);

    // Define fields
    const xAxisDim0 = queryResponse.fields.dimensions[0].name;
    const xAxisDim1 = queryResponse.fields.dimensions[1].name;
    const yAxisMeasure0 = queryResponse.fields.measures[0].name;

    // Check if the measure is a percentage
    const isPercentage = queryResponse.fields.measures[0].type === "percent";

    // Extract unique values for the X axis
    const xAxisDim0unique = Array.from(new Set(data.map(d => d[xAxisDim0]?.value)));

    // Create scales
    const xScaleDim0 = d3.scaleBand()
      .domain(xAxisDim0unique)
      .range([0, width])
      .padding(0.1);

    const xScaleDim1 = d3.scaleLinear()
      .domain([0, d3.max(data, d => d[xAxisDim1]?.value || 0)])
      .range([0, xScaleDim0.bandwidth()]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d[yAxisMeasure0]?.value || 0)]) // Use the measure value directly
      .range([height, 0]);

    // Y-axis format
    const yAxisFormat = isPercentage ? d3.format(".0%") : d3.format(".1f");

    // X-axis
    this._chartGroup.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xScaleDim0))
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end");

    // Y-axis
    this._chartGroup.append("g")
      .call(d3.axisLeft(yScale).tickFormat(yAxisFormat)); // Format the Y axis based on measure type

    // Plot points
    this._chartGroup.selectAll(".dot")
      .data(data)
      .enter().append("circle")
      .attr("class", "dot")
      .attr("r", 3)
      .attr("cx", d => xScaleDim0(d[xAxisDim0]?.value) + xScaleDim1(d[xAxisDim1]?.value || 0))
      .attr("cy", d => yScale(d[yAxisMeasure0]?.value || 0))  // Use measure value directly
      .style("fill", config.color_scheme[0] || "#1f77b4");

    // Significance threshold line
    const threshold = config.threshold;
    this._chartGroup.append("line")
      .attr("x1", 0)
      .attr("y1", yScale(threshold))
      .attr("x2", width)
      .attr("y2", yScale(threshold))
      .attr("stroke", "red")
      .attr("stroke-dasharray", "4");

    // Threshold label
    this._chartGroup.append("text")
      .attr("x", width - 100)
      .attr("y", yScale(threshold) - 10)
      .text(`Threshold: ${threshold}`)
      .style("fill", "red");

    // Notify Looker that rendering is complete
    done();
  }
});
