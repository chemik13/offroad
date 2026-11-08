-- Weekly tiles from the full OSM extract (GitHub Actions, branch "tiles") replace the per-area Overpass warmer.
select cron.unschedule('warm-trail-tiles');
