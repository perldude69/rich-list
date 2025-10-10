<form action=""  method="POST">
  <label form="fname">Wallet address or amount:</label><br>
  <input type="text" id="value" name="value" size="50" value="">
<br>
  <input type="submit" value="Submit">
</form> 

<?php
$server="localhost";
$user="xdb_user";
$pass="yourPassword";
$database="xrp";

function getval($xrpaddress)
{

	$server="localhost";
	$user="xdb_user";
	$pass="yourPassword";
	$database="xrp";

	$conn = new mysqli($server, $user, $pass, $database);
	if ($conn->connect_error) {
		die("ERROR: Unable to connect: " . $conn->connect_error);
	}
	 $result = $conn->query("select value from xrp.wallets where wallet like '$xrpaddress';");
	$row = $result->fetch_assoc();
	 if (isset($row["value"])) {
		 $balance=$row["value"];}
	 else { $balance = ""; }
	 #print "$balance";
	 return ($balance);
}

function getrank($amount) {
	$server="localhost";
	$user="xdb_user";
	$pass="yourPassword";
	$database="xrp";

	$conn = new mysqli($server, $user, $pass, $database);
        if ($conn->connect_error) {
                die("ERROR: Unable to connect: " . $conn->connect_error);
        }
         $result = $conn->query("select count(value) from xrp.wallets where value > '$amount';");
         $row = $result->fetch_assoc();
         $rank=$row["count(value)"];
	 return ($rank);
}
function getnumwallets() {
	$server="localhost";
	$user="xdb_user";
	$pass="yourPassword";
	$database="xrp";

        $conn = new mysqli($server, $user, $pass, $database);
        if ($conn->connect_error) {
                die("ERROR: Unable to connect: " . $conn->connect_error);
	}
	// SELECT numaccounts FROM richstats.stats where latest = 1;
	// "select count(value) from xrp.wallets;
         $result = $conn->query("SELECT numaccounts FROM richstats.stats where latest = 1;");
         $row = $result->fetch_assoc();
         $numwallets=$row["numaccounts"];
        return ($numwallets);
        }

function clean($string) {
   $string = str_replace(' ', '-', $string); // Replaces all spaces with hyphens.

   return preg_replace('/[^A-Za-z0-9\-]/', '', $string); // Removes special chars.
}



if (isset($_POST["value"])) {
	$val = $_POST["value"];
	$val = clean($val);
	if (!is_numeric($val)) {$val = getval($val); } ; 

if (is_numeric($val)) { $rank=getrank($val); }  else {echo "Bad address or address created after this ledger index."; }

if (isset($rank)) {
$totalwallets = getnumwallets();
$lower = ($totalwallets - $rank)-1;
$morewal = $rank-1;
$rankpercent = ($rank / $totalwallets)*100;
if (is_numeric($rank)) { print " You are ranked #$rank out of $totalwallets XRP wallets.</br> \n There are $morewal wallets with more XRP and $lower with less XRP.\n";
print "</br>That is in the top ". number_format($rankpercent,3). " % of accounts!\n";
}
}
}
?>
Visit our validator to see the server statistics. 
</br>
<a href='https://xrpscan.com/validator/nHUDtMdfkJaVVZ1tZBYtGH3dZyC2YbdTXbrkDgH6XS5uhJPUTfvy'>Rich-List.Info</a>
<!--
</br></br>
This is so cool. If you are an XRP enthusiist, this is a 'must' own. Check out the other XRP stuff they have too. 
</br><a href='https://tiproject.xyz/products/xrp-medallion?variant=40448231604272'>The TI Project - XRP - Medallion</a>
-->
