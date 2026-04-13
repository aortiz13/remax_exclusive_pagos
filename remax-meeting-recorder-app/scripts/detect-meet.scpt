set meetTitle to ""
try
    tell application "System Events"
        if exists (process "Google Chrome") then
            tell application "Google Chrome"
                repeat with w in windows
                    repeat with t in tabs of w
                        set tabTitle to title of t
                        set tabURL to URL of t
                        if tabURL starts with "https://meet.google.com/" and tabURL is not "https://meet.google.com/" then
                            set meetTitle to tabTitle
                            exit repeat
                        end if
                    end repeat
                    if meetTitle is not "" then exit repeat
                end repeat
            end tell
        end if
    end tell
end try
return meetTitle
