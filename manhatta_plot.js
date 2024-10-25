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

  // Inicialización de la visualización
  create: function(element, config) {
    // Cargar D3.js desde CDN si no está definido
    if (typeof d3 === 'undefined') {
      let script = document.createElement("script");
      script.src = "https://d3js.org/d3.v7.min.js"; // Puedes cambiar a la versión que prefieras
      script.onload = () => this.setupVisualization(element, config);
      document.head.appendChild(script);
    } else {
      this.setupVisualization(element, config);
    }
  },

  // Configuración de la visualización después de cargar D3.js
  setupVisualization: function(element, config) {
    // Limpieza del contenido anterior
    element.innerHTML = ``;
    
    // Definir márgenes
    const margin = { top: 20, right: 30, bottom: 50, left: 70 };

    // Crear SVG
    this._svg = d3.select(element)
      .append("svg")
      .attr("width", element.clientWidth)
      .attr("height", element.clientHeight);

    // Grupo del gráfico
    this._chartGroup = this._svg.append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Guardar márgenes
    this._margin = margin;
  },

  // Renderización de la visualización con los datos de Looker
  updateAsync: function(data, element, config, queryResponse, details, done) {
    // Validar que haya suficientes dimensiones y medidas
    if (!queryResponse.fields || !queryResponse.fields.dimensions || !queryResponse.fields.measures ||
        queryResponse.fields.dimensions.length < 2 || queryResponse.fields.measures.length < 1) {
      this.addError({
        title: "Datos insuficientes",
        message: "Esta visualización requiere al menos dos dimensiones y una medida."
      });
      return;
    }

    // Limpiar cualquier gráfico anterior
    this._chartGroup.selectAll("*").remove();

    // Recalcular ancho y alto del gráfico
    const margin = this._margin;
    const width = element.clientWidth - margin.left - margin.right;
    const height = element.clientHeight - margin.top - margin.bottom;

    // Actualizar dimensiones del SVG
    this._svg
      .attr("width", element.clientWidth)
      .attr("height", element.clientHeight);

    // Definir los campos
    const xAxisDim0 = queryResponse.fields.dimensions[0].name;
    const xAxisDim1 = queryResponse.fields.dimensions[1].name;
    const yAxisMeasure0 = queryResponse.fields.measures[0].name;

    // Extraer los valores únicos para el eje X
    const xAxisDim0unique = Array.from(new Set(data.map(d => d[xAxisDim0]?.value)));

    // Crear escalas
    const xScaleDim0 = d3.scaleBand()
      .domain(xAxisDim0unique)
      .range([0, width])
      .padding(0.1);

    const xScaleDim1 = d3.scaleLinear()
      .domain([0, d3.max(data, d => d[xAxisDim1]?.value || 0)])
      .range([0, xScaleDim0.bandwidth()]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d[yAxisMeasure0]?.value || 0)]) // Sin conversión -log10
      .range([height, 0]);

    // Ejes
    this._chartGroup.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xScaleDim0))
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end");

    this._chartGroup.append("g")
      .call(d3.axisLeft(yScale).tickFormat(d3.format(".1f")));

    // Dibujar los puntos
    this._chartGroup.selectAll(".dot")
      .data(data)
      .enter().append("circle")
      .attr("class", "dot")
      .attr("r", 3)
      .attr("cx", d => xScaleDim0(d[xAxisDim0]?.value) + xScaleDim1(d[xAxisDim1]?.value || 0))
      .attr("cy", d => yScale(d[yAxisMeasure0]?.value || 0))  // Usamos el valor tal cual
      .style("fill", config.color_scheme[0] || "#1f77b4");

    // Línea de umbral de significancia
    const threshold = config.threshold;
    this._chartGroup.append("line")
      .attr("x1", 0)
      .attr("y1", yScale(threshold))
      .attr("x2", width)
      .attr("y2", yScale(threshold))
      .attr("stroke", "red")
      .attr("stroke-dasharray", "4");

    // Etiqueta del umbral
    this._chartGroup.append("text")
      .attr("x", width - 100)
      .attr("y", yScale(threshold) - 10)
      .text(`Threshold: ${threshold}`)
      .style("fill", "red");

    // Indicar a Looker que el renderizado ha terminado
    done();
  }
});
