Set oShell = CreateObject("WScript.Shell")
oShell.CurrentDirectory = "C:\Users\如意郎君\Desktop\租车"
oShell.Run "cmd /c node server\api.js", 0, False
Set oShell = Nothing