@echo off
setlocal
if not defined JAVA_HOME set "JAVA_HOME=C:\Users\Umar Hayat\.gradle\jdks\eclipse_adoptium-21-amd64-windows.2"
if not defined ANDROID_HOME set "ANDROID_HOME=E:\Andriod"
"C:\Users\Umar Hayat\.gradle\wrapper\dists\gradle-8.11.1-bin\bpt9gzteqjrbo1mjrsomdt32c\gradle-8.11.1\bin\gradle.bat" %*
