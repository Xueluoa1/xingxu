param([string]$src, [string]$dst)
Add-Type -AssemblyName System.IO.Compression.FileSystem
if (Test-Path $dst) { Remove-Item $dst }
[IO.Compression.ZipFile]::CreateFromDirectory($src, $dst, [IO.Compression.CompressionLevel]::Optimal, $false)
(Get-Item $dst).Length
