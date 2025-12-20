#!/bin/bash
x=1
while [ $x -le 5 ]; do	
	curl http://localhost:8585/api/backfill/start
	sleep 20
done
