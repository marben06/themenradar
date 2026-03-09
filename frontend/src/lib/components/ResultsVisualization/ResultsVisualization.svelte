<script>
    import PieChartTonality from "./Charts/PieChartTonality.svelte";
    import LineChartHistorical from "./Charts/LineChartHistorical.svelte";
    import Summary from "./Summary.svelte";
    import TopArticle from "./TopArticle.svelte";
    import { ownTextSelected } from "$lib/shared";

    let { resultData, resolvedTopic } = $props();
    let element = $state(null); 

    let pieChartData = $state(null);
    let summary = $state(null);
    let topArticle = $state(null);
    let readyToScroll = $state(false);

    $effect(() => {
        if (!resultData) return;

        const newPieChartData = [
            { tone: "positive", percentage: resultData?.summary_recent?.percentages?.positive ?? 0 },
            { tone: "neutral",  percentage: resultData?.summary_recent?.percentages?.neutral  ?? 0 },
            { tone: "negative", percentage: resultData?.summary_recent?.percentages?.negative ?? 0 }
        ];


        const newSummary = resultData.summary_recent;
        const newTopArticle = resultData.results?.[0];

        const isEqual = JSON.stringify(pieChartData) === JSON.stringify(newPieChartData);

        if (!isEqual) {
            pieChartData = newPieChartData;
            summary = newSummary;
            topArticle = newTopArticle;
            readyToScroll = true;
            console.log(topArticle)
        }
    });


    $effect(() => {
        if (readyToScroll) {
            element.scrollIntoView({         
			behavior: 'smooth',
			block: 'start'
		});
        }
    })


//mockup data for testing
 /* const numbers = [
        { tone: "positive", percentage: 20 },
        { tone: "neutral", percentage: 30 },
        { tone: "negative", percentage: 50 }
  ];

  let topic = 'Klimmawandel';
  let resolvedTopic = 'Klimawandel Test'*/

  /*const summary = {
            "positive": 20,
            "neutral": 30,
            "negative": 50,
            "total": 100,
            "dominantSentiment": 'negativ'
        }*/

   /*let results = [{
            "article": {
                "title": "Deggendorfer Stadtgärtnerei: Grüner Daumen trotz Klimawandel. Was macht der Klimawandel mit dem Wetter?",
                "source": "Golem",
                "url": "https://www.golem.de/news/klimawandelsimulation-dubai-am-rhein-2505-195460.html",
                "publishedDate": "2022-09-28T08:14:24Z",
                "content": "Durch den Klimawandel treten Wetterextreme wie Dürren viel öfter auf. Ein Simulationswerkzeug zeigt, welchen Einfluss das lokal haben kann."
            },
            "analysis": "negative"
        }]
    let topArticle = results[0]*/

</script>

{#if !$ownTextSelected}
    <section>
        <div 
            class="bg"
            bind:this={element}>
            <h2 class='results-title'>Deine Auswertung zum Thema: {resolvedTopic.charAt(0).toUpperCase() + resolvedTopic.slice(1)}</h2>
        </div>
        
        <div class="results-visualization">
            {#if  pieChartData && summary && topArticle}
            <Summary {summary}/>
            <PieChartTonality 
                data={pieChartData}
            />
            <LineChartHistorical
                rawData={resultData.monthly_percentages}
            />
            <TopArticle 
                {topArticle} 
            />
            {/if} 
        </div>
    </section>
{/if}

<style>
    section {
        margin: 4rem auto;
        margin-top: 0.4rem;
        width: 80%;
        max-width: 1400px;
        padding: 0rem;
        box-shadow: rgba(100, 100, 111, 0.2) 0px 7px 29px 0px;
        border-radius: 20px;
    }

    .results-visualization {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        padding-bottom: 3rem;
        gap: 1rem;
    }

    .bg {
        background-color: var( --primary);
        border-top-left-radius: 20px;
        border-top-right-radius: 20px;
    }

    .results-title {
        text-align: center;
        padding: 2rem;
        padding-bottom: 2rem;
        margin: 0;
    }

    @media only screen and (max-width: 1000px) {
        .results-visualization {
            display: block;
            margin: auto;
        }

        section {
            width: 95%;
        }
    }

    
</style>