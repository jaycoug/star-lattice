' Star Lattice: puts a "Star Lattice" shortcut, with the app's icon, on your desktop.
' Double-click this file once. The shortcut starts Star Lattice in a minimized window
' (close that window to stop it). Run it again if you move this folder.
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
desk = sh.SpecialFolders("Desktop")
Set lnk = sh.CreateShortcut(desk & "\Star Lattice.lnk")
lnk.TargetPath = here & "\Start Star Lattice.cmd"
lnk.WorkingDirectory = here
lnk.WindowStyle = 7
lnk.IconLocation = here & "\app\icon.ico,0"
lnk.Description = "Start Star Lattice"
lnk.Save
MsgBox "A Star Lattice shortcut is now on your desktop." & vbCrLf & vbCrLf & "Double-click it to start. Close the minimized ""Star Lattice"" window to stop.", 64, "Star Lattice"
