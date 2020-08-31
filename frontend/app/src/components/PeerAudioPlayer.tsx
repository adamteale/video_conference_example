import React, { createRef } from "react";

type PeerAudioPlayerProps = {
  srcAudio: MediaStream;
  id: string;
};

type PeerAudioPlayerState = {
  srcAudio: MediaStream;
};

export class PeerAudioPlayer extends React.Component<
  PeerAudioPlayerProps,
  PeerAudioPlayerState
> {
  audioElement = createRef<HTMLAudioElement>();

  constructor(props: PeerAudioPlayerProps) {
    super(props);
    this.state = { srcAudio: this.props.srcAudio };
  }

  componentDidMount() {
    if (this.audioElement.current) {
      this.audioElement.current.srcObject = this.props.srcAudio;
    }
  }

  render() {
    return (
      <audio ref={this.audioElement} id={this.props.id} autoPlay={true}></audio>
    );
  }
}

export default PeerAudioPlayer;
