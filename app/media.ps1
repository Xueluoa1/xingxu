# 星叙媒体助手：读取系统媒体会话（SMTC）与网络流量，每秒输出一行 JSON；从标准输入接收 play / next / prev
param([string]$thumbDir)
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskG = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, [Type]$t) { $task = $asTaskG.MakeGenericMethod($t).Invoke($null, @($op)); $null = $task.Wait(3000); $task.Result }

[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null
[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null
$mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])

# 标准输入用原始流异步读取，不阻塞主循环
$stdin = [Console]::OpenStandardInput(); $buf = New-Object byte[] 1024; $pend = ''
$readTask = $stdin.ReadAsync($buf, 0, 1024)
$lastKey = ''; $thumb = ''; $n = 0

function SaveThumb($props) {
  try {
    if (-not $props.Thumbnail) { return '' }
    $s = Await ($props.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
    $ns = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($s)
    $script:n++
    $f = Join-Path $thumbDir ("cover" + ($script:n % 2) + ".img")
    $fs = [System.IO.File]::Create($f); $ns.CopyTo($fs); $fs.Close(); $ns.Close()
    return $f
  } catch { return '' }
}

while ($true) {
  # 命令
  while ($readTask.IsCompleted) {
    $got = $readTask.Result
    if ($got -le 0) { exit }   # 主程序退出，管道关闭
    $pend += [System.Text.Encoding]::UTF8.GetString($buf, 0, $got)
    while ($pend.Contains("`n")) {
      $i = $pend.IndexOf("`n"); $cmd = $pend.Substring(0, $i).Trim(); $pend = $pend.Substring($i + 1)
      $ses = $mgr.GetCurrentSession()
      if ($ses) {
        switch ($cmd) {
          # 部分播放器（如 QQ 音乐）会忽略 TogglePlayPause，但响应明确的 Play / Pause
          'play' {
            if ($ses.GetPlaybackInfo().PlaybackStatus -eq 'Playing') { $null = Await ($ses.TryPauseAsync()) ([bool]) }
            else { $null = Await ($ses.TryPlayAsync()) ([bool]) }
          }
          'next' { $null = Await ($ses.TrySkipNextAsync()) ([bool]) }
          'prev' { $null = Await ($ses.TrySkipPreviousAsync()) ([bool]) }
        }
      }
    }
    $readTask = $stdin.ReadAsync($buf, 0, 1024)
  }
  # 网络流量（全部活动网卡累计字节）
  $rx = 0; $tx = 0
  foreach ($ni in [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()) {
    if ($ni.OperationalStatus -ne 'Up' -or $ni.NetworkInterfaceType -eq 'Loopback') { continue }
    $st = $ni.GetIPv4Statistics(); $rx += $st.BytesReceived; $tx += $st.BytesSent
  }
  $o = [ordered]@{ net = @{ rx = $rx; tx = $tx }; media = $null }
  $ses = $mgr.GetCurrentSession()
  if ($ses) {
    $p = Await ($ses.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
    $tl = $ses.GetTimelineProperties(); $pb = $ses.GetPlaybackInfo()
    if ($p -and $p.Title) {
      $key = $p.Title + '|' + $p.Artist
      if ($key -ne $lastKey) { $lastKey = $key; $thumb = SaveThumb $p }
      $o.media = [ordered]@{
        title = $p.Title; artist = $p.Artist; album = $p.AlbumTitle; app = $ses.SourceAppUserModelId
        playing = ($pb.PlaybackStatus -eq 'Playing')
        pos = $tl.Position.TotalSeconds; dur = ($tl.EndTime - $tl.StartTime).TotalSeconds
        upd = $tl.LastUpdatedTime.ToUnixTimeMilliseconds()
        thumb = $thumb
      }
    }
  }
  [Console]::Out.WriteLine(($o | ConvertTo-Json -Compress -Depth 4))
  [Console]::Out.Flush()
  Start-Sleep -Milliseconds 1000
}
