function Versions(): React.JSX.Element {
  const versions = {
    chrome: navigator.userAgent.match(/Chrome\/([\d.]+)/)?.[1] || 'N/A',
    node: 'N/A (Browser)',
    electron: 'N/A (Browser)'
  }

  return (
    <ul className="versions">
      <li className="electron-version">Browser Web v1.0.11</li>
      <li className="chrome-version">Chromium v{versions.chrome}</li>
    </ul>
  )
}

export default Versions
