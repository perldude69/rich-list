<?php
#declare(strict_types=1);
$ledgernumber="$argv[1]";
$statfile='./data/' . $ledgernumber  . ".stats.json";
$fullledgerfile='./data/' . $ledgernumber  . ".json";
$snap="xrp";
function modDate($x) {
        $x = str_replace("Jan", "01", $x);
        $x = str_replace("Feb", "02", $x);
        $x = str_replace("Mar", "03", $x);
        $x = str_replace("Apr", "04", $x);
        $x = str_replace("May", "05", $x);
        $x = str_replace("Jun", "06", $x);
        $x = str_replace("Jul", "07", $x);
        $x = str_replace("Aug", "08", $x);
        $x = str_replace("Sep", "09", $x);
        $x = str_replace("Oct", "10", $x);
        $x = str_replace("Nov", "11", $x);
        $x = str_replace("Dec", "12", $x);
        $x = str_replace(" UTC", "", $x);
	$x = str_replace(".000000000", "", $x);
        return ($x);

}

function getBalance ($x) {
 	$conn = new mysqli("localhost", "xdb_user", "M00n\$hot!@!", "xrp");
	$sql = "select min(value) from (select wallets.value from wallets order by value desc limit $x) as subt;"; 
	if ($conn->connect_error) {
   		die("ERROR: Unable to connect: " . $conn->connect_error);
 	}
	$result = $conn->query("$sql;");
	$row = $result->fetch_assoc();
	$bal= $row["min(value)"];
    	$result->close();
    	$conn->close();
    	return ($bal);
}

function getNumberofAccounts ($a) {
	$snap="xrp";
	$conn = new mysqli("localhost", "xdb_user", "M00n\$hot!@!", $snap);
	$result = $conn->query("$a;");
	$row = $result->fetch_assoc();
	$walletcount = $row["count(*)"];
	return ($walletcount);
	}


function accountsandsumsinrange ($x,$y) {
	$snap="xrp";
	$conn = new mysqli("localhost", "xdb_user", "M00n\$hot!@!", $snap);

 if ($conn->connect_error) {
   die("ERROR: Unable to connect: " . $conn->connect_error);
 }

    $myvalues  = array();

    $result = $conn->query("select value from wallets where value > $x and value < $y");
    $row = $result->fetch_assoc();
    array_push( $myvalues, $result->num_rows );

    $result = $conn->query("select sum(value) from wallets where value > $x and value < $y");
    $row = $result->fetch_assoc();
    array_push( $myvalues, $row["sum(value)"]);
    $result->close();
    $conn->close();
    return ($myvalues);
}

function setPercents ($a,$b,$c,$d,$e) {
    $conn = new mysqli("localhost", "xdb_user", "M00n\$hot!@!", "richstats");

 if ($conn->connect_error) {
   die("ERROR: Unable to connect: " . $conn->connect_error);
 }
    $sql="update richstats.top10percentages SET $a=?, $b=? where ledgerindex=?";
    #print "$sql\n";
    $stmt=$conn->prepare($sql);
    $stmt->bind_param("iii",$c,$d,$e);
    $stmt->execute();
    $conn->close();
}

function setAccountStats ($a,$b,$c,$d,$e) {
    $conn = new mysqli("localhost", "xdb_user", "M00n\$hot!@!", "richstats");

 if ($conn->connect_error) {
   die("ERROR: Unable to connect: " . $conn->connect_error);
 }
    $sql="update richstats.top18accountstats SET $a=?, $b=? where ledgerindex=?";
    $stmt=$conn->prepare($sql);
    $stmt->bind_param("iii",$c,$d,$e);
    $stmt->execute();
    $conn->close();
}
function baselineStats($ledgerIndex,$ledgerDate,$totalXRP,$walletXRP,$Escrow,$numAccounts) {
	$conn = new mysqli("localhost", "xdb_user", "M00n\$hot!@!", "richstats");
 	if ($conn->connect_error) {
   	die("ERROR: Unable to connect: " . $conn->connect_error); }
	#Check for index enrty
	$sql="select ledgerindex from richstats.stats where ledgerindex = '$ledgerIndex'";
	$result = $conn->query("$sql");
        $row = $result->fetch_assoc();
	if ($row) { 
		## Exists, need to update with these values
		$sql = "update richstats.stats SET ledgerdate=?, totalxrp=?, walletxrp=?, escrowxrp=?, numaccounts=? where ledgerindex=?";
		$stmt=$conn->prepare($sql);
    		$stmt->bind_param("iiiiii",$ledgerDate,$totalXRP,$walletXRP,$Escrow,$numAccounts,$ledgerIndex);
    		$stmt->execute();
	} else 
	{	
	$sql="insert into richstats.stats (ledgerindex, ledgerdate, totalxrp, walletxrp, escrowxrp, numaccounts) values ('$ledgerIndex','$ledgerDate','$totalXRP','$walletXRP','$Escrow','$numAccounts')";
	if (mysqli_query($conn, $sql)) { print "";} else {print "Error on insert.". mysqli_error($conn)." \n";}
        $sql="insert into richstats.top10percentages (ledgerindex, ledgerdate) values ('$ledgerIndex','$ledgerDate')";
	if (mysqli_query($conn, $sql)) { print "";} else {print "Error on insert.". mysqli_error($conn)." \n";}
	$sql="insert into richstats.top18accountstats (ledgerindex, ledgerdate) values ('$ledgerIndex','$ledgerDate')";
        if (mysqli_query($conn, $sql)) { print ""; } else {print "Error on insert.". mysqli_error($conn)." \n";}
	$conn->close();	
	}
}

$string = file_get_contents($statfile);
$json_a = json_decode($string, true);
$li=$json_a['meta']['ledgerIndex'];
$ledgerdate=modDate($json_a['meta']['ledgerClosedAt']);
$existingXRP=$json_a['meta']['existingXRP'];
$numberofaccounts=$json_a['meta']['numberAccounts'];
$string2= file_get_contents($fullledgerfile);
$json_b=json_decode($string2,true);
$xrpinwallets=array_sum(array_column($json_b["balances"],"b"));
$xrpinescrow=$existingXRP - $xrpinwallets;
baselineStats($li,$ledgerdate,$existingXRP,$xrpinwallets,$xrpinescrow,$numberofaccounts);
######################################################
$base=0;
$max=100000000000000;

$numberofaccounts = getNumberofAccounts("select count(*) from wallets");

$accountsA= $json_a['accountPercentageBalance'][0]['numberAccounts'];//floor($numberofaccounts * .0001);
$accountsB= $json_a['accountPercentageBalance'][1]['numberAccounts'];//floor($numberofaccounts * .001);
$accountsC= $json_a['accountPercentageBalance'][2]['numberAccounts'];//floor($numberofaccounts * .002);
$accountsD= $json_a['accountPercentageBalance'][3]['numberAccounts'];//floor($numberofaccounts * .005);
$accountsE= $json_a['accountPercentageBalance'][4]['numberAccounts'];//floor($numberofaccounts * .01);
$accountsF= $json_a['accountPercentageBalance'][5]['numberAccounts'];//floor($numberofaccounts * .02);
$accountsG= $json_a['accountPercentageBalance'][6]['numberAccounts'];//floor($numberofaccounts * .03); 
$accountsH= $json_a['accountPercentageBalance'][7]['numberAccounts'];//floor($numberofaccounts * .04);
$accountsI= $json_a['accountPercentageBalance'][8]['numberAccounts'];//floor($numberofaccounts * .05);
$accountsJ= $json_a['accountPercentageBalance'][9]['numberAccounts'];//floor($numberofaccounts * .1);
$accoBallA= $json_a['accountPercentageBalance'][0]['balanceEqGt'];//getBalance($accountsA);
$accoBallB= $json_a['accountPercentageBalance'][1]['balanceEqGt'];//getBalance($accountsB);
$accoBallC= $json_a['accountPercentageBalance'][2]['balanceEqGt'];//getBalance($accountsC);
$accoBallD= $json_a['accountPercentageBalance'][3]['balanceEqGt'];//getBalance($accountsD);
$accoBallE= $json_a['accountPercentageBalance'][4]['balanceEqGt'];//getBalance($accountsE);
$accoBallF= $json_a['accountPercentageBalance'][5]['balanceEqGt'];//getBalance($accountsF);
$accoBallG= $json_a['accountPercentageBalance'][6]['balanceEqGt'];//getBalance($accountsG);
$accoBallH= $json_a['accountPercentageBalance'][7]['balanceEqGt'];//getBalance($accountsH);
$accoBallI= $json_a['accountPercentageBalance'][8]['balanceEqGt'];//getBalance($accountsI);
$accoBallJ= $json_a['accountPercentageBalance'][9]['balanceEqGt'];//getBalance($accountsJ);
setPercents ("topacts1","topbal1",$accountsA,$accoBallA,$li);
setPercents ("topacts2","topbal2",$accountsB,$accoBallB,$li);
setPercents ("topacts3","topbal3",$accountsC,$accoBallC,$li);
setPercents ("topacts4","topbal4",$accountsD,$accoBallD,$li);
setPercents ("topacts5","topbal5",$accountsE,$accoBallE,$li);
setPercents ("topacts6","topbal6",$accountsF,$accoBallF,$li);
setPercents ("topacts7","topbal7",$accountsG,$accoBallG,$li);
setPercents ("topacts8","topbal8",$accountsH,$accoBallH,$li);
setPercents ("topacts9","topbal9",$accountsI,$accoBallI,$li);
setPercents ("topacts10","topbal10",$accountsJ,$accoBallJ,$li);

#######################################################




$mya = [$json_a['accountNumberBalanceRange'][0]['numberAccounts'],$json_a['accountNumberBalanceRange'][0]['balanceSum']]; //accountsandsumsinrange(1000000000,999999999999);
$myb = [$json_a['accountNumberBalanceRange'][1]['numberAccounts'],$json_a['accountNumberBalanceRange'][1]['balanceSum']]; //accountsandsumsinrange(500000000,1000000000);
$myc = [$json_a['accountNumberBalanceRange'][2]['numberAccounts'],$json_a['accountNumberBalanceRange'][2]['balanceSum']]; //accountsandsumsinrange(100000000,500000000);
$myd = [$json_a['accountNumberBalanceRange'][3]['numberAccounts'],$json_a['accountNumberBalanceRange'][3]['balanceSum']]; //accountsandsumsinrange(20000000,100000000);
$mye = [$json_a['accountNumberBalanceRange'][4]['numberAccounts'],$json_a['accountNumberBalanceRange'][4]['balanceSum']]; //accountsandsumsinrange(10000000,20000000);
$myf = [$json_a['accountNumberBalanceRange'][5]['numberAccounts'],$json_a['accountNumberBalanceRange'][5]['balanceSum']]; //accountsandsumsinrange(5000000,10000000);
$myg = [$json_a['accountNumberBalanceRange'][6]['numberAccounts'],$json_a['accountNumberBalanceRange'][6]['balanceSum']]; //accountsandsumsinrange(1000000,5000000);
$myh = [$json_a['accountNumberBalanceRange'][7]['numberAccounts'],$json_a['accountNumberBalanceRange'][7]['balanceSum']]; //accountsandsumsinrange(500000,1000000);
$myi = [$json_a['accountNumberBalanceRange'][8]['numberAccounts'],$json_a['accountNumberBalanceRange'][8]['balanceSum']]; //accountsandsumsinrange(100000,500000);
$myj = [$json_a['accountNumberBalanceRange'][9]['numberAccounts'],$json_a['accountNumberBalanceRange'][9]['balanceSum']]; //accountsandsumsinrange(75000,100000);
$myk = [$json_a['accountNumberBalanceRange'][10]['numberAccounts'],$json_a['accountNumberBalanceRange'][10]['balanceSum']]; //accountsandsumsinrange(50000,75000);
$myl = [$json_a['accountNumberBalanceRange'][11]['numberAccounts'],$json_a['accountNumberBalanceRange'][11]['balanceSum']]; //accountsandsumsinrange(25000,50000);
$mym = [$json_a['accountNumberBalanceRange'][12]['numberAccounts'],$json_a['accountNumberBalanceRange'][12]['balanceSum']]; //accountsandsumsinrange(10000,25000);
$myn = [$json_a['accountNumberBalanceRange'][13]['numberAccounts'],$json_a['accountNumberBalanceRange'][13]['balanceSum']]; //accountsandsumsinrange(5000,10000);
$myo = [$json_a['accountNumberBalanceRange'][14]['numberAccounts'],$json_a['accountNumberBalanceRange'][14]['balanceSum']]; //accountsandsumsinrange(1000,5000);
$myp = [$json_a['accountNumberBalanceRange'][15]['numberAccounts'],$json_a['accountNumberBalanceRange'][15]['balanceSum']]; //accountsandsumsinrange(500,1000);
$myq = [$json_a['accountNumberBalanceRange'][16]['numberAccounts'],$json_a['accountNumberBalanceRange'][16]['balanceSum']]; //accountsandsumsinrange(20,500);
$myr = [$json_a['accountNumberBalanceRange'][17]['numberAccounts'],$json_a['accountNumberBalanceRange'][17]['balanceSum']]; //accountsandsumsinrange(0,20);
setAccountStats("top1","top1ct",$mya[1],$mya[0],$li);
setAccountStats("top2","top2ct",$myb[1],$myb[0],$li);
setAccountStats("top3","top3ct",$myc[1],$myc[0],$li);
setAccountStats("top4","top4ct",$myd[1],$myd[0],$li);
setAccountStats("top5","top5ct",$mye[1],$mye[0],$li);
setAccountStats("top6","top6ct",$myf[1],$myf[0],$li);
setAccountStats("top7","top7ct",$myg[1],$myg[0],$li);
setAccountStats("top8","top8ct",$myh[1],$myh[0],$li);
setAccountStats("top9","top9ct",$myi[1],$myi[0],$li);
setAccountStats("top10","top10ct",$myj[1],$myj[0],$li);
setAccountStats("top11","top11ct",$myk[1],$myk[0],$li);
setAccountStats("top12","top12ct",$myl[1],$myl[0],$li);
setAccountStats("top13","top13ct",$mym[1],$mym[0],$li);
setAccountStats("top14","top14ct",$myn[1],$myn[0],$li);
setAccountStats("top15","top15ct",$myo[1],$myo[0],$li);
setAccountStats("top16","top16ct",$myp[1],$myp[0],$li);
setAccountStats("top17","top17ct",$myq[1],$myq[0],$li);
setAccountStats("top18","top18ct",$myr[1],$myr[0],$li);
?>
<table class="styled-table" border="2">
<thead><tr>
<th colspan="3">-- Number of accounts and sum of balance range</th>
</tr></thead>
<tbody>
<tr class="active-row"><td colspan="3"># Accounts   Balance from  ... To                     Sum (XRP)</td></tr>
<tr><td align="center"><?php echo number_format((int)$mya[0],0);?></td><td align="center">1,000,000,000 - Infinity</td><td align="center"><?php echo number_format((int)$mya[1],6);?></td></tr>
<tr><td align="center"><?php echo number_format($myb[0],0);?></td><td align="center">500,000,000 - 1,000,000,000</td><td align="center"><?php echo number_format($myb[1],6);?></td></tr>
<tr><td align="center"><?php echo number_format($myc[0],0);?></td><td align="center">100,000,000 - 500,000,000</td><td align="center"><?php echo number_format($myc[1],6);?></td></tr>
<tr><td align="center"><?php echo number_format($myd[0],0);?></td><td align="center">20,000,000 - 100,000,000</td><td align="center"><?php echo number_format($myd[1],6);?></td></tr>
<tr><td align="center"><?php echo number_format($mye[0],0);?></td><td align="center">10,000,000 - 20,000,000</td><td align="center"><?php echo number_format($mye[1],6);?></td></tr>
<tr><td align="center"><?php echo number_format($myf[0],0);?></td><td align="center">5,000,000 - 10,000,000</td><td align="center"><?php echo number_format($myf[1],6);?></td></tr>
<tr><td align="center"><?php echo number_format($myg[0],0);?></td><td align="center">1,000,000 - 5,000,000</td><td align="center"><?php echo number_format($myg[1],6);?></td></tr>
<tr><td align="center"><?php echo number_format($myh[0],0);?></td><td align="center">500,000 - 1,000,000</td><td align="center"><?php echo number_format($myh[1],6);?></td></tr>
<tr><td align="center"><?php echo number_format($myi[0],0);?></td><td align="center">100,000 - 500,000</td><td align="center"><?php echo number_format($myi[1],6);?></td></tr>
<tr><td align="center"><?php echo number_format($myj[0],0);?></td><td align="center">75,000 - 100,000</td><td align="center"><?php echo number_format($myj[1],6);?></td></tr>
<tr><td align="center"><?php echo number_format($myk[0],0);?></td><td align="center">50,000 - 75,000</td><td align="center"><?php echo number_format($myk[1],6);?></td></tr>
<tr><td align="center"><?php echo number_format($myl[0],0);?></td><td align="center">25,000 - 50,000</td><td align="center"><?php echo number_format($myl[1],6);?></td></tr>
<tr><td align="center"><?php echo number_format($mym[0],0);?></td><td align="center">10,000 - 25,000</td><td align="center"><?php echo number_format($mym[1],6);?></td></tr>
<tr><td align="center"><?php echo number_format($myn[0],0);?></td><td align="center">5,000 - 10,000</td><td align="center"><?php echo number_format($myn[1],6);?></td></tr>
<tr><td align="center"><?php echo number_format($myo[0],0);?></td><td align="center">1,000 - 5,000</td><td align="center"><?php echo number_format($myo[1],6);?></td></tr>
<tr><td align="center"><?php echo number_format($myp[0],0);?></td><td align="center">500 - 1,000</td><td align="center"><?php echo number_format($myp[1],6);?></td></tr>
<tr><td align="center"><?php echo number_format($myq[0],0);?></td><td align="center">20 - 500</td><td align="center"><?php echo number_format($myq[1],6);?></td></tr>
<tr><td align="center"><?php echo number_format($myr[0],0);?></td><td align="center">0 - 20</td><td align="center"><?php echo number_format($myr[1],6);?></td></tr>
</tbody>
</table>




<table class="styled-table" border="2" id="percents">
<thead><tr><th colspan="3">Percentage of accounts with balance starting at...</th></tr></thead>
<tbody>
<tr class="active-row"><td colspan="3">Percentage  # Accounts  Balance equals (or greater than)</td></tr>
<tr><td align="center">0.01 %</td><td align="center"><?php echo number_format($accountsA,0); ?></td><td align="center"><?php echo number_format($accoBallA,6); ?> XRP</td></tr>
<tr><td align="center">0.1 %</td><td align="center"><?php echo  number_format($accountsB,0); ?></td><td align="center"><?php echo number_format($accoBallB,6); ?> XRP</td></tr>
<tr><td align="center">0.2 %</td><td align="center"><?php echo  number_format($accountsC,0); ?></td><td align="center"><?php echo number_format($accoBallC,6); ?> XRP</td></tr>
<tr><td align="center">0.5 %</td><td align="center"><?php echo  number_format($accountsD,0); ?></td><td align="center"><?php echo number_format($accoBallD,6); ?> XRP</td></tr>
<tr><td align="center">1 %</td><td align="center"><?php echo  number_format($accountsE,0); ?></td><td align="center"><?php echo number_format($accoBallE,6); ?> XRP</td></tr>
<tr><td align="center">2 %</td><td align="center"><?php echo  number_format($accountsF,0); ?></td><td align="center"><?php echo number_format($accoBallF,6); ?> XRP</td></tr>
<tr><td align="center">3 %</td><td align="center"><?php echo  number_format($accountsG,0); ?></td><td align="center"><?php echo number_format($accoBallG,6); ?> XRP</td></tr>
<tr><td align="center">4 %</td><td align="center"><?php echo  number_format($accountsH,0); ?></td><td align="center"><?php echo number_format($accoBallH,6); ?> XRP</td></tr>
<tr><td align="center">5 %</td><td align="center"><?php echo  number_format($accountsI,0); ?></td><td align="center"><?php echo number_format($accoBallI,6); ?> XRP</td></tr>
<tr><td align="center">10 %</td><td align="center"><?php echo  number_format($accountsJ,0); ?></td><td align="center"><?php echo number_format($accoBallJ,6); ?> XRP</td></tr>
</tbody>
</table>
<div class="picharts" id="pichartsContainer" style="position: absolute; top: 5rem; left: 40rem; height: 25rem; width: 60rem;" ></div>
<div class="picharts2" id="pichartsContainer2" style="position: absolute; top: 32rem; left: 40rem; height: 25rem; width: 60rem;" ></div>
<script>
function loadpicharts() {
var pichart_accounts = new CanvasJS.Chart("pichartsContainer",
        {
                title:{
                        text: "Sum of Balance Ranges."
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
                                { y: <?php echo (int)$myr[1];?>, indexLabel: "0-20" },
                                { y: <?php echo (int)$myq[1];?>, indexLabel: "20-500" },
                                { y: <?php echo (int)$myp[1];?>, indexLabel: "500-1,000" },
                                { y: <?php echo (int)$myo[1];?>, indexLabel: "1,000-5,000" },
                                { y: <?php echo (int)$myn[1];?>, indexLabel: "5,000-10,000" },
                                { y: <?php echo (int)$mym[1];?>, indexLabel: "10,000-25,000" },
                                { y: <?php echo (int)$myl[1];?>, indexLabel: "25,000-50,000" },
                                { y: <?php echo (int)$myk[1];?>, indexLabel: "50,000-75,000" },
                                { y: <?php echo (int)$myj[1];?>, indexLabel: "75,000-100,000" },
                                { y: <?php echo (int)$myi[1];?>, indexLabel: "100,000-500,000" },
                                { y: <?php echo (int)$myh[1];?>, indexLabel: "500,000-1,000,000" },
                                { y: <?php echo (int)$myg[1];?>, indexLabel: "1,000,000-5,000,000" },
                                { y: <?php echo (int)$myf[1];?>, indexLabel: "5,000,000-10,000,000" },
                                { y: <?php echo (int)$mye[1];?>, indexLabel: "10,000,000-20,000,000" },
                                { y: <?php echo (int)$myd[1];?>, indexLabel: "20,000,000-100,000,000"},
                                { y: <?php echo (int)$myc[1];?>, indexLabel: "10,000,000-500,000,000" },
                                { y: <?php echo (int)$myb[1];?>, indexLabel: "500,000,000-1,000,000,000"},
                                { y: <?php echo (int)$mya[1];?>, indexLabel: "1,000,000,000-Infinity"}
                        ]
                }
                ]
});

var pichart_accounts2 = new CanvasJS.Chart("pichartsContainer2",
        {
                title:{
                        text: "Number of accounts in each of the Percentage Ranges."
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
                                { y: <?php echo (int)$accountsA;?>, indexLabel: "0.01 %" },
                                { y: <?php echo (int)$accountsB;?>, indexLabel: "0.1 %" },
                                { y: <?php echo (int)$accountsC;?>, indexLabel: "0.2 %" },
                                { y: <?php echo (int)$accountsD;?>, indexLabel: "0.5 %" },
                                { y: <?php echo (int)$accountsE;?>, indexLabel: "1 %" },
                                { y: <?php echo (int)$accountsF;?>, indexLabel: "2 %" },
                                { y: <?php echo (int)$accountsG;?>, indexLabel: "3 %" },
                                { y: <?php echo (int)$accountsH;?>, indexLabel: "4 %" },
                                { y: <?php echo (int)$accountsI;?>, indexLabel: "5 %" },
                                { y: <?php echo (int)$accountsJ;?>, indexLabel: "10 %" },
                        ]
                }
                ]
});


pichart_accounts.render();
pichart_accounts2.render();
}
</script>
