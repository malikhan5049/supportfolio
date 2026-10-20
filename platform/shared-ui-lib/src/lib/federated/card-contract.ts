/** The contract every project's exposed `./card` default component implements. */
export interface RemoteCardComponent {
  title: string;
  description: string;
  features: string[];
  openUrl: string;
}
