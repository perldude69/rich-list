<!DOCTYPE html>
<html>
<head>
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="msapplication-TileColor" content="#da532c">
<meta name="theme-color" content="#ffffff">
<link rel="stylesheet" href="https://www.w3schools.com/w3css/4/w3.css">
<script src="https://ajax.googleapis.com/ajax/libs/jquery/2.1.0/jquery.min.js"></script>
<script src="https://unpkg.com/xrpl@2.0.0/build/xrpl-latest-min.js"></script>
<script src="https://canvasjs.com/assets/script/canvasjs.min.js"></script>
<style>
.styled-table {
    border-collapse: collapse;
    margin: 25px 0;
    font-size: 0.9em;
    font-family: sans-serif;
    min-width: 400px;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.15);
}

.styled-table thead tr {
/*    background-color: #009879; */
    background-color: #000000;
    color: #ffffff;
    text-align: left;
}

.styled-table tbody tr {
    border-bottom: 1px solid #dddddd;
}

.styled-table tbody tr:nth-of-type(even) {
    background-color: #f3f3f3;
}

.styled-table tbody tr:last-of-type {
    border-bottom: 2px solid #009879;
}

.styled-table tbody tr.active-row {
    font-weight: bold;
    color: #009879;
}
.walletchart {
        top: 40rem;
        left: 50rem;
        height: 30rem;
        width: 65rem;

}
<?php
function getwalchart() {
        $server="localhost";
        $user="xdb_user";
        $pass="yourPassword";
        $database="richstats";
        $stack=array();
        $w=array();
        $conn = new mysqli($server, $user, $pass, $database);
        if ($conn->connect_error) {
                die("ERROR: Unable to connect: " . $conn->connect_error);
        }
         $result = $conn->query("SELECT ledgerdate,numaccounts FROM richstats.stats;");
        while($row = $result->fetch_assoc()) {
                array_push($stack,$row);
        }

        foreach($stack as $row => $innerArray){
        $datetime = new DateTime($innerArray["ledgerdate"]);
        $timestamp = $datetime->format('U');
        $timestamp=$timestamp*1000;
        array_push($w, array("y"=>(int)($innerArray["numaccounts"]),"x"=>$timestamp));
        }
        return ($w);
}




function getledgerstats() {
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

$xrpstats=getledgerstats();
$ledgerindex=$xrpstats["ledgerindex"];
$ledgerdate=$xrpstats["ledgerdate"];
$totalxrp=$xrpstats["totalxrp"];
$walletxrp=$xrpstats["walletxrp"];
$walletcount=$xrpstats["numaccounts"];
?>

</style>
<script>
async function getPrice() {
  const client = new xrpl.Client("wss://xrplcluster.com/");
  var steve = "Awaiting Connection...";
  await client.connect();
  client.request({
    "id": "Get current price",
            "command": "subscribe",
            "accounts": ["rXUMMaPpZqPutoRszR29jtC8amWq3APkx"]
  });
  client.on("transaction", async (transactions) => {
        document.getElementById('xrpPrice').innerHTML = "Current XRP price in USD: " + transactions.transaction.LimitAmount.value;
  });
 document.getElementById('xrpPrice').innerHTML = "Current XRP price in USD: waiting....";
}
getPrice();
</script>
</head>
<body>
<div style="z-index:10; position: absolute; right: 35px; top: 70px; " > <table>
<tr><td>Ledger index: <?php echo $ledgerindex; ?> </td> </tr>
<tr><td>Ledger date: <?php echo $ledgerdate; ?> UTC </td> </tr>
<tr><td>Total XRP: <?php echo number_format($totalxrp,6); ?> </td> </tr>
<tr><td>XRP not in escrow: <?php echo number_format($walletxrp,6); ?> </td> </tr>
<tr><td><div id="xrpPrice" >Current XRP price in USD:  ...</div><td><tr>
<tr><td>Number of XRP wallets: <?php echo  number_format($walletcount,0); ?></td> </tr>
<tr><td><div class="walchart chartdiv" id="walchart">for Andy</div><td></tr>
<!--
<tr><td>XRP Address:</td></tr>
<tr><td><img src="./rich-list.png"></img></td></tr>
<tr><td>rsWsqeCHgLBr5jEt1uF7M7atpeeYcSQCEi</td></tr>
-->
</table></div>
<script>
function loadWalChart() {

var chartW = new CanvasJS.Chart("walchart", {
        animationEnabled: true,
        theme: "light2",
        title:{
                text: "Historic Wallet Count"
        },
        axisX: {
                valueFormatString: "DD MMM YY"
        },
        axisY: {
                title: "",
                includeZero: false,
                maximum: 7500000,
                minimum: 4080000
        },
        data: [{
                type: "splineArea",
                color: "#a05195",
                xValueType: "dateTime",
                xValueFormatString: "DD MMM",
                yValueFormatString: "#,##0 WALLETS",
                dataPoints: <?php
                        $myda = getwalchart();
                        echo json_encode($myda); ?>
        }]
});

chartW.render();
}
loadWalChart();
</script>

<style>
a:hover {
  background-color: #589022;
}
</style>

<script>
function openLink(cityName) {
  var i;
  var x = document.getElementsByClassName("city");
  for (i = 0; i < x.length; i++) {
    x[i].style.display = "none";  
  }
  document.getElementById(cityName).style.display = "block";  
}
</script>



<!--
<div style="position: fixed; bottom: 0; right: 0"> Help the Community help you.<br />  <a href="https://decentralend.co/campaigns/1"> Donate to WietseWind's Ledger Device Audit </a></br>Thank you to WietseWind! </div>
-->
<div class="w3-bar w3-black">
  <button class="w3-bar-item w3-button" onclick="openLink('Richsearch')">Ranking Search</button>
  <button class="w3-bar-item w3-button" onclick="openLink('Currentstats'); loadpicharts();">Current Statistics</button>
  <button class="w3-bar-item w3-button" onclick="openLink('History'); loadCharts();">Historic</button>
  <button class="w3-bar-item w3-button" onclick="openLink('Trustlines')">Trustlines</button>
  <button class="w3-bar-item w3-button" ><marquee>Rich-List.Info</marquee></button>
</div>

<div id="Currentstats" class="w3-container city" style="display:none">
        <?php include "currentstats.html"; ?>
</div>
<div id="Richsearch" class="w3-container city" style="display:block">
        <?php include "richsearch.php"; ?>
</div>
<div id="History" class="w3-container city" style="display:none">
        <?php include "chart.php"; ?>
</div>
<div id="Trustlines" class="w3-container city" style="display:none">
<?php include "trustlines.php"; ?>
</div>

</body>
</html>
