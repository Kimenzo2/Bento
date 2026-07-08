$modPath = "src-tauri/src/clipboard/mod.rs"
$bookmarksPath = "src-tauri/src/clipboard/bookmarks.rs"

# ── Fields to add after `external_content: None,` in ClipEntry constructions ──
$newFields = @"
            og_title: None,
            og_description: None,
            og_image: None,
            og_site_name: None,
            platform: None,
            saved_timestamp_seconds: None,
            recopy_count: 0,
            enrichment_status: "none".to_string(),
"@

# ─── Fix mod.rs ───
$f = Get-Content $modPath -Raw

# Count occurrences
$count = [System.Text.RegularExpressions.Regex]::Matches($f, "external_content: None,").Count
Write-Output "mod.rs: Found $count occurrences of 'external_content: None,'"

# The pattern we need to replace in the entry constructions:
# `external_content: None,\n        };\n`
# Replace with the new fields before `};`
$f = $f.Replace(
    "external_content: None,`r`n        };",
    "external_content: None,`r`n$newFields`r`n        };"
)

# Also handle the second variant with the comma on the same line
$f = $f.Replace(
    "external_content: Some(true),`r`n        };",
    "external_content: Some(true),`r`n$newFields`r`n        };"
)

Set-Content -Path $modPath -Value $f
Write-Output "mod.rs: Updated ClipEntry constructions"

# ─── Fix bookmarks.rs (handle_url_save construction) ───
$bf = Get-Content $bookmarksPath -Raw
if ($bf.Contains("external_content: None,")) {
    $bf = $bf.Replace(
        "external_content: None,`r`n    };",
        "external_content: None,`r`n$newFields`r`n    };"
    )
    Set-Content -Path $bookmarksPath -Value $bf
    Write-Output "bookmarks.rs: Updated ClipEntry construction"
} else {
    # Search for handle_url_save's ClipEntry construction
    $pattern = "external_content: None,"
    if ($bf.Contains("external_content: None")) {
        $bf = $bf.Replace("external_content: None,", "external_content: None,$newFields")
        # But need to handle the `};` after
        $bf = $bf.Replace("$newFields`r`n        };", "$newFields`r`n        };")
        Set-Content -Path $bookmarksPath -Value $bf
        Write-Output "bookmarks.rs: Updated"
    } else {
        Write-Output "bookmarks.rs: No 'external_content: None' found — checking for bookmarks-specific construction"
    }
}

# ── Verify ──
$f2 = Get-Content $modPath -Raw
$remaining = [System.Text.RegularExpressions.Regex]::Matches($f2, "external_content: None,`r`n        };").Count
Write-Output "mod.rs: Remaining unpatched occurrences: $remaining"
