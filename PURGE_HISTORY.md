# Remove wix-images/ from git history

wix-images/ (raw Wix export, ~187 MB) is only an output folder of scripts/wix-export-images.mjs.
The import reads scripts/wix-import/images instead, which stays.

1. Copy wix-images/ somewhere outside the repo if you want to keep it.
2. pip install git-filter-repo
3. Work in a fresh clone (filter-repo refuses to run on a used one):
       git clone https://github.com/AloysiousOrbegoso/5rSuites 5rSuites-clean
       cd 5rSuites-clean
       git filter-repo --path wix-images --invert-paths
4. Commit your local changes first (git apply the patches, add .gitignore entry `wix-images/`),
   or apply them in the clean clone after step 3.
5. filter-repo removes the origin remote. Re-add it and force-push:
       git remote add origin https://github.com/AloysiousOrbegoso/5rSuites
       git push --force --all origin
6. Anyone else with a clone must re-clone. On GitHub, old commits can stay reachable through
   cached PR refs; contact GitHub support to run garbage collection if that matters.

Tested on a copy of this repo: pack size 191 MiB -> 6.4 MiB.
