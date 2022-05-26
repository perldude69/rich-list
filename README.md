# rich-list
The source for rich-list.info
This is the source for rich-list.info
The source is basically a combination of:
php
perl
mysql databases
crontab entry
bash scripts
and a small XRP ledger (rippled)
All of these work together using a crontab entry to:
Download a json snapshot of the current XRP ledger *wallets and balances
Run a modified npm script to extract statistics from this json
Export this information to sql
import the sql into mysql
create databases and tables to feed the site php
create static html files 

