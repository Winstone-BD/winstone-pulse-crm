import { Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { HomeErrorBoundary } from "../../src/components/HomeErrorBoundary";

declare global { interface Window { __fail: boolean } }
function Home() {
  if (window.__fail) throw new Error("Forced homepage render failure");
  return <h1>Home loaded</h1>;
}
class Boundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown };
  static getDerivedStateFromError(error: unknown) { return { error }; }
  render() {
    if (this.state.error) return <HomeErrorBoundary error={this.state.error as Error} reset={() => this.setState({ error: null })} info={undefined as never} />;
    return this.props.children;
  }
}
createRoot(document.getElementById("root")!).render(<Boundary><Home /></Boundary>);
