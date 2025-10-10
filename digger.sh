#!/usr/bin/bash
let ledger=$(/usr/local/bin/rippled server_info | grep "complete_ledgers" | awk '{print$3}' | awk -F'[\-]'  '{print$2}' | sed 's/\".//g')
if [ $? -ne 0 ]; then
    echo "Get ledger # command failed. Exit the script"
    exit 1
fi
/usr/bin/npm run fetch $ledger
if [ $? -ne 0 ]; then
    echo "npm fetch command failed. Exit the script"
    exit 1
fi
/usr/bin/npm run stats $ledger
if [ $? -ne 0 ]; then
    echo "npm stats command failed. Exit the script"
    exit 1
fi
/usr/bin/php makeCurrentStatsfromJson.php $ledger >  /var/www/rich-list/currentstats.html
if [ $? -ne 0 ]; then
    echo "makeCurrentStats command failed. Exit the script"
    exit 1
fi
/usr/bin/perl parseXRP.pl $ledger
if [ $? -ne 0 ]; then
    echo "parseXRP command failed. Exit the script"
    exit 1
fi
mysql -u root  -p'mysqlPassword' < "./data/$ledger.json.sql"
if [ $? -ne 0 ]; then
    echo "mysql injest command failed. Exit the script"
    exit 1
fi
