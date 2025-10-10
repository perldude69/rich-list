<table border = '1'>
<?php

function getTrustlines() {
        $server="localhost";
        $user="xdb_user";
        $pass="yourPassword";
        $database="trustlines";
	$stack=array();
        $conn = new mysqli($server, $user, $pass, $database);
        if ($conn->connect_error) {
                die("ERROR: Unable to connect: " . $conn->connect_error);
        }
         $result = $conn->query("select * from trustlines.currencies;");
	        while($row = $result->fetch_assoc()) {
                array_push($stack,$row);
        }
        return ($stack);


}
$trustlines = getTrustlines();

foreach ($trustlines as $row) {
	print "<tr><td><a href=\"https:\/\/bithomp.com\/explorer\/".$row["issuer"]."\">".$row["issuer"] . "</td><td>" . $row["currency"] . "</td></tr>\n";

}

?>
</table>
