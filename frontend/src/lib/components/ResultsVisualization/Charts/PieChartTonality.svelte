<script>
  import { arc, pie } from "d3-shape";
  import { scaleOrdinal } from "d3-scale";
  import { interpolate } from "d3-interpolate";
  import { select } from "d3-selection";
  import { fade } from "svelte/transition";
  import { innerWidth } from 'svelte/reactivity/window';

  // Svelte 5: access reactive props
  let { data } = $props();

  let pieData = $state();
  let width = $state(360);
  let height = $derived(width);
  let outerRadiusFactor =  $state(0.8);

  $effect(() => {
    if (innerWidth.current <= 1000) {
      width = 500;
      outerRadiusFactor =  0.8;
    } else {
      width = 360;
      outerRadiusFactor =  0.8;
    };
  })


  // Color scale by tone
  const colorScale = scaleOrdinal()
    .domain(["positive", "neutral", "negative"])
    .range(["#FFD166", "#FFB74D", "#FF8A65"]);

  // Arc generators
  let arcGenerator = $derived(arc()
    .innerRadius((0.5 * height) / 2.4)
    .outerRadius((0.8 * height) / 2.2)
    .cornerRadius(4));

  let labelArcs = $derived(arc()
    .innerRadius((0.9 * height) / 2.1)
    .outerRadius((0.9 * height) / 2));

  // Compute pie layout
  const pieGenerator = pie()
    .value(d => d.percentage)
    .sort(null);

  $effect(() => {
    if (!data || data.length === 0) {
      pieData= [];
    } else {
    pieData = pieGenerator(data)
    }
  })  


  // Animation transition for each slice
  const reveal = (node, { index }) => {
    const d = pieData[index];
    const start = +d.startAngle;
    const end = +d.endAngle;
    let i = interpolate(start, end);

    return {
      delay: index * (end - start) * 20 + 300,
      duration: 400,
      tick: (t) => {
        d.endAngle = i(t);
        select(node).attr("d", arcGenerator(d));
      }
    };
  };
</script>
<div class="item-container">
<h3 class="pie-chart-title">Verteilung der Stimmung</h3>
<div class="pie-chart-container" bind:clientWidth={width}>
<svg {width} {height} class="chart">
  <g transform="translate({width / 2} {height / 2 })">
    {#each pieData as d, i (d.data.tone)}
      <path
        in:reveal={{ index: i }}
        d={arcGenerator(d)}
        fill={colorScale(d.data.tone)}
        stroke="white"
        stroke-width="2"
      />
      {#if d.data.percentage > 0}
        <text
          in:fade={{ delay: 800 }}
          font-size="0.75em"
          text-anchor="middle"
          class="fill-black-100"
          transform="translate({labelArcs.centroid(d).join(',')})"
        >
          {d.data.tone}
        </text>
        <text
          in:fade={{ delay: 1000 }}
          font-size="0.75em"
          font-weight="bold"
          text-anchor="middle"
          transform="translate({labelArcs.centroid(d).join(',')})"
          y="1.2em"
          class="fill-black-100"
        >
          {d.data.percentage}%
        </text>
        {/if}
    {/each}
  </g>
</svg>
</div>
</div>

<style>

  .pie-chart-container {
    width: 85%;
    margin: auto;
  }

  .chart {
    display: block;
    overflow: visible;
  }

  .pie-chart-title {
    text-align: center;
  }

  .fill-black-100 {
    fill: #1E1E1E;
  }

  @media only screen and (max-width: 1000px) {
    .pie-chart-container {
      width: 100%;
    }

    .chart {
      margin: auto;
    }
  }

  
</style>
