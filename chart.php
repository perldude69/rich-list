<script src="https://canvasjs.com/assets/script/canvasjs.min.js"></script>
<?php
$count=0;
function getstats() {
        $server="localhost";
        $user="xdb_user";
        $pass="yourPassword";
        $database="richstats";
	$stack=array();
        $conn = new mysqli($server, $user, $pass, $database);
        if ($conn->connect_error) {
                die("ERROR: Unable to connect: " . $conn->connect_error);
        }
         $result = $conn->query("select * from richstats.top18accountstats;");
	while($row = $result->fetch_assoc()) {
		array_push($stack,$row);
	}
        return ($stack);
}

function getlatestledger() {
        $server="localhost";
        $user="xdb_user";
        $pass="yourPassword";
        $database="richstats";

        $conn = new mysqli($server, $user, $pass, $database);
        if ($conn->connect_error) {
                die("ERROR: Unable to connect: " . $conn->connect_error);
        }
         $result = $conn->query("select * from richstats.stats where latest='1';");
         $row = $result->fetch_assoc();
        return ($row);
}

function getstatslatest($x) {
        $server="localhost";
        $user="xdb_user";
        $pass="yourPassword";
        $database="richstats";

        $conn = new mysqli($server, $user, $pass, $database);
        if ($conn->connect_error) {
                die("ERROR: Unable to connect: " . $conn->connect_error);
        }
         $result = $conn->query("select * from richstats.top18accountstats where ledgerindex ='$x';");
         $row = $result->fetch_assoc();
        return ($row);
}

$latestledger=getlatestledger();
$ledgerindex=$latestledger["ledgerindex"];
$stats=getstatslatest($ledgerindex);

$dp1=array();
$dp2=array();
$dp3=array();
$dp4=array();
$dp5=array();
$dp6=array();
$dp7=array();
$dp8=array();
$dp9=array();
$dp10=array();
$dp11=array();
$dp12=array();
$dp13=array();
$dp14=array();
$dp15=array();
$dp16=array();
$dp17=array();
$dp18=array();
$stats1 = getstats();
foreach($stats1 as $row => $innerArray){
	$datetime = new DateTime($innerArray["ledgerdate"]);
	$timestamp = $datetime->format('U');
	$timestamp=$timestamp*1000;
	array_push($dp1, array("y"=>(int)($innerArray["top1"]),"x"=>$timestamp));
	array_push($dp2, array("y"=>(int)($innerArray["top2"]),"x"=>$timestamp));
	array_push($dp3, array("y"=>(int)($innerArray["top3"]),"x"=>$timestamp));
	array_push($dp4, array("y"=>(int)($innerArray["top4"]),"x"=>$timestamp));
	array_push($dp5, array("y"=>(int)($innerArray["top5"]),"x"=>$timestamp));
	array_push($dp6, array("y"=>(int)($innerArray["top6"]),"x"=>$timestamp));
	array_push($dp7, array("y"=>(int)($innerArray["top7"]),"x"=>$timestamp));
	array_push($dp8, array("y"=>(int)($innerArray["top8"]),"x"=>$timestamp));
	array_push($dp9, array("y"=>(int)($innerArray["top9"]),"x"=>$timestamp));
	array_push($dp10, array("y"=>(int)($innerArray["top10"]),"x"=>$timestamp));
	array_push($dp11, array("y"=>(int)($innerArray["top11"]),"x"=>$timestamp));
	array_push($dp12, array("y"=>(int)($innerArray["top12"]),"x"=>$timestamp));
	array_push($dp13, array("y"=>(int)($innerArray["top13"]),"x"=>$timestamp));
	array_push($dp14, array("y"=>(int)($innerArray["top14"]),"x"=>$timestamp));
	array_push($dp15, array("y"=>(int)($innerArray["top15"]),"x"=>$timestamp));
	array_push($dp16, array("y"=>(int)($innerArray["top16"]),"x"=>$timestamp));
	array_push($dp17, array("y"=>(int)($innerArray["top17"]),"x"=>$timestamp));
	array_push($dp18, array("y"=>(int)($innerArray["top18"]),"x"=>$timestamp));
}







 
?>

<link rel="stylesheet" href="chartstyle.css">
<div class="top1 chartdiv" id="chartContainer1"></div>
<div class="top2 chartdiv" id="chartContainer2" ></div>
<div class="top3 chartdiv" id="chartContainer3"></div>
<div class="top4 chartdiv" id="chartContainer4"></div>
<div class="top5 chartdiv"  id="chartContainer5"></div>
<div class="top6 chartdiv" id="chartContainer6"></div>
<div class="top7 chartdiv" id="chartContainer7"></div>
<div class="top8 chartdiv" id="chartContainer8"></div>
<div class="top9 chartdiv" id="chartContainer9"></div>
<div class="top10 chartdiv" id="chartContainer10"></div>
<div class="top11 chartdiv" id="chartContainer11"></div>
<div class="top12 chartdiv" id="chartContainer12"></div>
<div class="top13 chartdiv" id="chartContainer13"></div>
<div class="top14 chartdiv" id="chartContainer14"></div>
<div class="top15 chartdiv" id="chartContainer15"></div>
<div class="top16 chartdiv" id="chartContainer16"></div>
<div class="top17 chartdiv" id="chartContainer17"></div>
<div class="top18 chartdiv" id="chartContainer18"></div>
<div class="dist chartdiv" id="chartContainerdist"></div>
<div class="pi chartdiv" id="pichartContainer"></div>

<script>
function loadCharts() {

var chart1 = new CanvasJS.Chart("chartContainer1", {
        animationEnabled: true,
        theme: "light2",
        title:{
                text: "1,000,000,000 - Infinity"
        },
        axisX: {
                valueFormatString: "DD MMM YY"
        },
        axisY: {
                title: "",
                includeZero: false,
                maximum: 15000000000,
                minimum: 4000000000
        },
        data: [{
                type: "splineArea",
                color: "#a05195",
                xValueType: "dateTime",
                xValueFormatString: "DD MMM",
                yValueFormatString: "#,##0 XRP",
                dataPoints: <?php echo json_encode($dp1); ?>
        }]
});


var chart2 = new CanvasJS.Chart("chartContainer2", {
        animationEnabled: true,
        theme: "light2",
        title:{
                text: "500,000,000 - 1,000,000,000"
        },
        axisX: {
                valueFormatString: "DD MMM YY"
        },
        axisY: {
                title: "",
                includeZero: false,
                maximum: 14000000000,
                minimum: 6000000000
        },
        data: [{
                type: "splineArea",
                color: "#6599FF",
                xValueType: "dateTime",
                xValueFormatString: "DD MMM",
                yValueFormatString: "#,##0 XRP",
                dataPoints: <?php echo json_encode($dp2); ?>
        }]
});

var chart3 = new CanvasJS.Chart("chartContainer3", {
        animationEnabled: true,
        theme: "light2",
        title:{
                text: "100,000,000 - 500,000,000"
        },
        axisX: {
                valueFormatString: "DD MMM YY"
        },
        axisY: {
                title: "",
                includeZero: false,
                maximum: 16000000000,
                minimum: 12000000000
        },
        data: [{
                type: "splineArea",
                color: "#ffa600",
                xValueType: "dateTime",
                xValueFormatString: "DD MMM",
                yValueFormatString: "#,##0 XRP",
                dataPoints: <?php echo json_encode($dp3); ?>
        }]
});

var chart4 = new CanvasJS.Chart("chartContainer4", {
        animationEnabled: true,
        theme: "light2",
        title:{
                text: "20,000,000 - 100,000,000"
        },
        axisX: {
                valueFormatString: "DD MMM YY"
        },
        axisY: {
                title: "#ff7c43",
                includeZero: false,
                maximum: 5500000000,
                minimum: 3500000000
        },
        data: [{
                type: "splineArea",
                color: "#000000",
                xValueType: "dateTime",
                xValueFormatString: "DD MMM",
                yValueFormatString: "#,##0 XRP",
                dataPoints: <?php echo json_encode($dp4); ?>
        }]
});

var chart5 = new CanvasJS.Chart("chartContainer5", {
        animationEnabled: true,
        theme: "light2",
        title:{
                text: "10,000,000 - 20,000,000"
        },
        axisX: {
                valueFormatString: "DD MMM YY"
        },
        axisY: {
                title: "",
                includeZero: false,
                maximum: 2500000000,
                minimum: 1000000000
        },
        data: [{
                type: "splineArea",
                color: "#f95d6a",
                xValueType: "dateTime",
                xValueFormatString: "DD MMM",
                yValueFormatString: "#,##0 XRP",
                dataPoints: <?php echo json_encode($dp5); ?>
        }]
});
var chart6 = new CanvasJS.Chart("chartContainer6", {
        animationEnabled: true,
        theme: "light2",
        title:{
                text: "5,000,000 - 10,000,000"
        },
        axisX: {
                valueFormatString: "DD MMM YY"
        },
        axisY: {
                title: "",
                includeZero: false,
                maximum: 1700000000,
                minimum: 800000000
        },
        data: [{
                type: "splineArea",
                color: "#d45087",
                xValueType: "dateTime",
                xValueFormatString: "DD MMM",
                yValueFormatString: "#,##0 XRP",
                dataPoints: <?php echo json_encode($dp6); ?>
        }]
});
var chart7 = new CanvasJS.Chart("chartContainer7", {
        animationEnabled: true,
        theme: "light2",
        title:{
                text: "1,000,000 - 5,000,000"
        },
        axisX: {
                valueFormatString: "DD MMM YY"
        },
        axisY: {
                title: "",
                includeZero: false,
                maximum: 3000000000,
                minimum: 1000000000
        },
        data: [{
                type: "splineArea",
                color: "#a05195",
                xValueType: "dateTime",
                xValueFormatString: "DD MMM",
                yValueFormatString: "#,##0 XRP",
                dataPoints: <?php echo json_encode($dp7); ?>
        }]
});
var chart8 = new CanvasJS.Chart("chartContainer8", {
        animationEnabled: true,
        theme: "light2",
        title:{
                text: "500,000 - 1,000,000"
        },
        axisX: {
                valueFormatString: "DD MMM YY"
        },
        axisY: {
                title: "",
                includeZero: false,
                maximum: 1600000000,
                minimum: 1000000000
        },
        data: [{
                type: "splineArea",
                color: "#665191",
                xValueType: "dateTime",
                xValueFormatString: "DD MMM",
                yValueFormatString: "#,##0 XRP",
                dataPoints: <?php echo json_encode($dp8); ?>
        }]
});
var chart9 = new CanvasJS.Chart("chartContainer9", {
        animationEnabled: true,
        theme: "light2",
        title:{
                text: "100,000 - 500,000"
        },
        axisX: {
                valueFormatString: "DD MMM YY"
        },
        axisY: {
                title: "",
                includeZero: false,
                maximum: 6000000000,
                minimum: 3500000000
        },
        data: [{
                type: "splineArea",
                color: "#003f5c",
                xValueType: "dateTime",
                xValueFormatString: "DD MMM",
                yValueFormatString: "#,##0 XRP",
                dataPoints: <?php echo json_encode($dp9); ?>
        }]
});


var chart10 = new CanvasJS.Chart("chartContainer10", {
        animationEnabled: true,
        theme: "light2",
        title:{
                text: "75,000 - 100,000"
        },
        axisX: {
                valueFormatString: "DD MMM YY"
        },
        axisY: {
                title: "",
                includeZero: false,
                maximum: 900000000,
                minimum: 600000000
        },
        data: [{
                type: "splineArea",
                color: "#a05195",
                xValueType: "dateTime",
                xValueFormatString: "DD MMM",
                yValueFormatString: "#,##0 XRP",
                dataPoints: <?php echo json_encode($dp10); ?>
        }]
});


var chart11 = new CanvasJS.Chart("chartContainer11", {
        animationEnabled: true,
        theme: "light2",
        title:{
                text: "50,000 - 75,000"
        },
        axisX: {
                valueFormatString: "DD MMM YY"
        },
        axisY: {
                title: "",
                includeZero: false,
                maximum: 1400000000,
                minimum: 950000000 
        },
        data: [{
                type: "splineArea",
                color: "#6599FF",
                xValueType: "dateTime",
                xValueFormatString: "DD MMM",
                yValueFormatString: "#,##0 XRP",
                dataPoints: <?php echo json_encode($dp11); ?>
        }]
});


var chart12 = new CanvasJS.Chart("chartContainer12", {
        animationEnabled: true,
        theme: "light2",
        title:{
                text: "25,000 - 50,000"
        },
        axisX: {
                valueFormatString: "DD MMM YY"
        },
        axisY: {
                title: "",
                includeZero: false,
                maximum: 2000000000,
                minimum: 1300000000 
        },
        data: [{
                type: "splineArea",
                color: "#ffa600",
                xValueType: "dateTime",
                xValueFormatString: "DD MMM",
                yValueFormatString: "#,##0 XRP",
                dataPoints: <?php echo json_encode($dp12); ?>
        }]
});


var chart13 = new CanvasJS.Chart("chartContainer13", {
        animationEnabled: true,
        theme: "light2",
        title:{
                text: "10,000 - 25,000"
        },
        axisX: {
                valueFormatString: "DD MMM YY"
        },
        axisY: {
                title: "",
                includeZero: false,
                maximum: 2100000000,
                minimum: 1350000000 
        },
        data: [{
                type: "splineArea",
                color: "#ff7c43",
                xValueType: "dateTime",
                xValueFormatString: "DD MMM",
                yValueFormatString: "#,##0 XRP",
                dataPoints: <?php echo json_encode($dp13); ?>
        }]
});


var chart14 = new CanvasJS.Chart("chartContainer14", {
        animationEnabled: true,
        theme: "light2",
        title:{
                text: "5,000 - 10,000"
        },
        axisX: {
                valueFormatString: "DD MMM YY"
        },
        axisY: {
                title: "",
                includeZero: false,
                maximum: 900000000,
                minimum: 550000000 
        },
        data: [{
                type: "splineArea",
                color: "#f95d6a",
                xValueType: "dateTime",
                xValueFormatString: "DD MMM",
                yValueFormatString: "#,##0 XRP",
                dataPoints: <?php echo json_encode($dp14); ?>
        }]
});


var chart15 = new CanvasJS.Chart("chartContainer15", {
        animationEnabled: true,
        theme: "light2",
        title:{
                text: "1,000 - 5,000"
        },
        axisX: {
                valueFormatString: "DD MMM YY"
        },
        axisY: {
                title: "",
                includeZero: false,
                maximum: 1000000000,
                minimum: 600000000
        },
        data: [{
                type: "splineArea",
                color: "#d45087",
                xValueType: "dateTime",
                xValueFormatString: "DD MMM",
                yValueFormatString: "#,##0 XRP",
                dataPoints: <?php echo json_encode($dp15); ?>
        }]
});

var chart16 = new CanvasJS.Chart("chartContainer16", {
        animationEnabled: true,
        theme: "light2",
        title:{
                text: "500 - 1000"
        },
        axisX: {
                valueFormatString: "DD MMM YY"
        },
        axisY: {
                title: "",
                includeZero: false,
                maximum: 135000000,
		minimum: 108000000
        },
        data: [{
                type: "splineArea",
                color: "#a05195",
                xValueType: "dateTime",
                xValueFormatString: "DD MMM",
                yValueFormatString: "#,##0 XRP",
                dataPoints: <?php echo json_encode($dp16); ?>
        }]
});

var chart17 = new CanvasJS.Chart("chartContainer17", {
        animationEnabled: true,
        theme: "light2",
        title:{
                text: "20 - 500"
        },
        axisX: {
                valueFormatString: "DD MMM YY"
        },
        axisY: {
                title: "",
                includeZero: false,
                maximum: 195000000,
                minimum: 155000000
	},
        data: [{
                type: "splineArea",
                color: "#665191",
                xValueType: "dateTime",
                xValueFormatString: "DD MMM",
                yValueFormatString: "#,##0 XRP",
                dataPoints: <?php echo json_encode($dp17); ?>
        }]
});

var chart18 = new CanvasJS.Chart("chartContainer18", {
        animationEnabled: true,
        theme: "light2",
        title:{
                text: "0 - 20"
        },
        axisX: {
                valueFormatString: "DD MMM YY"
        },
        axisY: {
                title: "",
                includeZero: false,
                maximum: 16500000,
                minimum: 11000000
        },
        data: [{
                type: "splineArea",
                color: "#003f5c",
                xValueType: "dateTime",
                xValueFormatString: "DD MMM",
                yValueFormatString: "#,##0 XRP",
                dataPoints: <?php echo json_encode($dp18); ?>
        }]
});
var chartdist = new CanvasJS.Chart("chartContainerdist",
    {
      axisY:{
                logarithmic:  true
        },
      title:{
        text: "Current XRP Distribution"
      },
      data: [
      {
        type: "bar",
        dataPoints: [
        { y: <?php echo $stats["top18"];?> , label: "0-20"},
        { y: <?php echo $stats["top17"];?> , label: "20-500"},
        { y: <?php echo $stats["top16"];?> , label: "500-1,000"},
        { y: <?php echo $stats["top15"];?> , label: "1,000-5,000"},
        { y: <?php echo $stats["top14"];?> , label: "5,000-10,000"},
        { y: <?php echo $stats["top13"];?> , label: "10,000-25,000"},
        { y: <?php echo $stats["top12"];?> , label: "25,000-50,000"},
        { y: <?php echo $stats["top11"];?> , label: "50,000-75,000"},
        { y: <?php echo $stats["top10"];?> , label: "75,000-100,000"},
        { y: <?php echo $stats["top9"];?> , label: "100,000-500,000"},
        { y: <?php echo $stats["top8"];?> , label: "500,000-1,000,000"},
        { y: <?php echo $stats["top7"];?> , label: "1,000,000-5,000,000"},
        { y: <?php echo $stats["top6"];?> , label: "5,000,000-10,000,000"},
        { y: <?php echo $stats["top5"];?> , label: "10,000,000-20,000,000"},
        { y: <?php echo $stats["top4"];?> , label: "20,000,000-100,000,000"},
        { y: <?php echo $stats["top3"];?> , label: "10,000,000-500,000,000"},
        { y: <?php echo $stats["top2"];?> , label: "500,000,000-1,000,000,000"},
        { y: <?php echo $stats["top1"];?> , label: "1,000,000,000-Infinity"}
        ]
      }
      ]
    });

var pichart = new CanvasJS.Chart("pichartContainer",
	{
		title:{
			text: "Number of accounts and sum of balance range."
		},
		legend: {
			maxWidth: 350,
			itemWidth: 120
		},
		data: [
		{
			type: "pie",
			showInLegend: false,
			legendText: "{indexLabel}",
			dataPoints: [
    				{ y: <?php echo (int)$stats["top18"];?>, indexLabel: "0-20" },
				{ y: <?php echo (int)$stats["top17"];?>, indexLabel: "20-500" },
				{ y: <?php echo (int)$stats["top16"];?>, indexLabel: "500-1,000" },
    				{ y: <?php echo (int)$stats["top15"];?>, indexLabel: "1,000-5,000" },
    				{ y: <?php echo (int)$stats["top14"];?>, indexLabel: "5,000-10,000" },
    				{ y: <?php echo (int)$stats["top12"];?>, indexLabel: "25,000-50,000" },
    				{ y: <?php echo (int)$stats["top11"];?>, indexLabel: "50,000-75,000" },
    				{ y: <?php echo (int)$stats["top10"];?>, indexLabel: "75,000-100,000" },
    				{ y: <?php echo (int)$stats["top8"];?>, indexLabel: "100,000-500,000" },
    				{ y: <?php echo (int)$stats["top8"];?>, indexLabel: "500,000-1,000,000" },
    				{ y: <?php echo (int)$stats["top7"];?>, indexLabel: "1,000,000-5,000,000" },
				{ y: <?php echo (int)$stats["top6"];?>, indexLabel: "5,000,000-10,000,000" },
				{ y: <?php echo (int)$stats["top5"];?>, indexLabel: "10,000,000-20,000,000" },
				{ y: <?php echo (int)$stats["top4"];?>, indexLabel: "20,000,000-100,000,000"},
				{ y: <?php echo (int)$stats["top3"];?>, indexLabel: "10,000,000-500,000,000" },
				{ y: <?php echo (int)$stats["top2"];?>, indexLabel: "500,000,000-1,000,000,000"},
				{ y: <?php echo (int)$stats["top1"];?>, indexLabel: "1,000,000,000-Infinity"}
			]
		}
		]
	});



chart1.render();
chart2.render();
chart3.render();
chart4.render();
chart5.render();
chart6.render();
chart7.render();
chart8.render();
chart9.render();
chart10.render();
chart11.render();
chart12.render();
chart13.render();
chart14.render();
chart15.render();
chart16.render();
chart17.render();
chart18.render();
//chartdist.render();
//pichart.render();

}
</script>
