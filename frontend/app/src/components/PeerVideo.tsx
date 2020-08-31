import React, { createRef } from "react";
import { Prompt } from "react-router-dom";
import { PeerVideoPlayer } from "./PeerVideoPlayer";
import { PeerAudioPlayer } from "./PeerAudioPlayer";

import { Row, Col } from "antd";
import { Select } from "antd";

import { Input } from "antd";
import { Button } from "antd";

const { Option } = Select;

function getRandomColor() {
  var letters = "0123456789ABCDEF";
  var color = "#";
  for (var i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

interface CanvasElement extends HTMLCanvasElement {
  captureStream(): MediaStream;
}

interface PeerVideoPlayerDictionary {
  [Key: string]: JSX.Element[];
}

enum ConnectionState {
  disconnected = 0,
  connecting = 1,
  connected = 2,
}

enum DataChannelParameter {
  orderedReliable = '{"ordered": true}',
  unorderedNoRetransmissions = '{"ordered": false, "maxRetransmits": 0}',
  unordered500ms = '{"ordered": false, "maxPacketLifetime": 500}',
}

enum AudioCodecParameter {
  default = "",
  opus48000 = "opus/48000/2",
  pcmu = "PCMU/8000",
  pcma = "PCMA/8000",
}

//generates random id;
let guid = () => {
  let s4 = () => {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  };
  //return id of format 'aaaaaaaa'-'aaaa'-'aaaa'-'aaaa'-'aaaaaaaaaaaa'
  return (
    s4() +
    s4() +
    "-" +
    s4() +
    "-" +
    s4() +
    "-" +
    s4() +
    "-" +
    s4() +
    s4() +
    s4()
  );
};

type Peer = {
  id: string;
  pc: RTCPeerConnection;
  username: string;
};

type PeerVideoProps = {
  id: string;
};

type PeerVideoState = {
  useStun: boolean;
  dataChannelParameter: DataChannelParameter;
  audioCodecParameter: AudioCodecParameter;
  videoCodec: string;
  rtcPeerConnections: { [id: string]: Peer };
  // peer connection
  dc?: RTCDataChannel;
  dcInterval?: NodeJS.Timeout;
  useVideo: boolean;
  // useAudio: boolean;
  useDataChannel: boolean;
  videoTracks: { [id: string]: MediaStream };
  audioTracks: { [id: string]: MediaStream };
  connectionState: ConnectionState;
  totalHorizontalViews: number;
  showDebugging: boolean;
  stream: MediaStream;
  hasCameraPermission: boolean;
  videoEnabled: boolean;
  audioEnabled: boolean;
  screenSharingEnabled: boolean;
  debugEnabled: boolean;
};

let ws: WebSocket;
const wsEndpoint = `${process.env.REACT_APP_WS_API_PROTOCOL}${process.env.REACT_APP_WSROOM_PATH}/wsroom`;

export class PeerVideo extends React.Component<PeerVideoProps, PeerVideoState> {
  iceConnectionLog = createRef<HTMLSpanElement>();
  iceGatheringLog = createRef<HTMLSpanElement>();
  signalingLog = createRef<HTMLSpanElement>();
  startButton = createRef<HTMLButtonElement>();
  useDataChannelInput = createRef<HTMLInputElement>();
  datachannelParametersSelect = createRef<HTMLSelectElement>();
  dataChannelLog = createRef<HTMLPreElement>();
  offerSDPPre = createRef<HTMLPreElement>();
  answerSDPPre = createRef<HTMLPreElement>();
  // myVideo = createRef<PeerVideoPlayer>();
  canvasRef = createRef<CanvasElement>();

  videoTracks: { [id: string]: MediaStream } = {};

  websocketRef = createRef<WebSocket>();

  thisId: string;
  peers: { [id: string]: Peer } = {};

  baseVideoSize = {
    width: 320,
    height: 240,
  };

  username: string = "";

  constructor(props: PeerVideoProps) {
    super(props);

    this.state = {
      useStun: true,
      dataChannelParameter: DataChannelParameter.unorderedNoRetransmissions,
      audioCodecParameter: AudioCodecParameter.opus48000,
      videoCodec: "default",
      rtcPeerConnections: {},
      useVideo: true,
      // useAudio: true,
      useDataChannel: false,
      videoTracks: {},
      audioTracks: {},
      connectionState: ConnectionState.disconnected,
      totalHorizontalViews: 2,
      showDebugging: false,
      stream: new MediaStream(),
      hasCameraPermission: false,
      videoEnabled: false,
      screenSharingEnabled: false,
      audioEnabled: false,
      debugEnabled: false,
    };

    this.thisId = guid();

    console.log("PeerVideo .... init");
  }

  componentDidMount() {
    (async () => await this.getMyCameraAndMic())();
    // (async () => await this.getMyScreen())()

    window.onbeforeunload = (e: BeforeUnloadEvent) => {
      console.log("Stop this");
      e.preventDefault();
      e.returnValue = "";
    };
  }

  replaceTracksInPeers = () => {
    Object.keys(this.peers).forEach((keyid: string, index: number) => {
      let senders = this.peers[keyid].pc.getSenders();
      senders.forEach((sender) => {
        if (sender.track?.kind === "video") {
          sender.replaceTrack(this.state.stream.getVideoTracks()[0]);
        } else if (sender.track?.kind === "audio") {
          sender.replaceTrack(this.state.stream.getAudioTracks()[0]);
        }
      });
    });
  };

  async getMyScreen() {
    console.log("this.state", this.state);

    try {
      var displayMediaOptions = {
        video: {
          cursor: "always",
        },
        audio: true,
      };

      const mediaDevices = navigator.mediaDevices as any;
      const stream = await mediaDevices.getDisplayMedia(displayMediaOptions);

      const videoTracks = {
        ...this.state.videoTracks,
        ["me"]: stream,
      };

      this.setState({
        stream: stream,
        screenSharingEnabled: true,
        videoTracks: videoTracks,
        videoEnabled: true,
        audioEnabled: true,
      });

      Object.keys(this.peers).forEach((keyid: string, index: number) => {
        let senders = this.peers[keyid].pc.getSenders();
        senders.forEach((sender) => {
          if (sender.track?.kind === "video") {
            sender.replaceTrack(this.state.stream.getVideoTracks()[0]);
          }
        });
      });
    } catch (err) {
      console.error("Error: " + err);
    }
  }

  async getMyCameraAndMic() {
    console.log("getMyCameraAndMic");
    let ctx = this.canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.fillStyle = getRandomColor();
      ctx.fillRect(0, 0, this.baseVideoSize.width, this.baseVideoSize.height);
      ctx.font = "12px sans-serif";
      ctx.fillStyle = "white";
      ctx.fillText(`${this.thisId}`, 9, 18);
    }

    console.log("NO CAMERA YET");

    var constraints = {
      audio: {},
      video: {
        width: { ideal: this.baseVideoSize.width },
        height: { ideal: this.baseVideoSize.height },
      },
    };

    try {
      console.log("will ask again");
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (stream) {
        console.log("got cam", stream);
        this.setState({
          stream: stream,
          hasCameraPermission: true,
          videoEnabled: true,
          audioEnabled: true,
        });
      } else {
        console.log("Could not acquire media");
        if (this.canvasRef.current) {
          let canvas = this.canvasRef.current;
          this.setState({
            stream: canvas.captureStream(),
          });
          console.log("CANVAS", canvas.captureStream());
        }
      }

      this.replaceTracksInPeers();
    } catch (e) {
      console.log("gotcam denied");
      if (this.canvasRef.current) {
        let canvas = this.canvasRef.current;
        this.setState({
          stream: canvas.captureStream(),
          hasCameraPermission: false,
        });
        console.log("CANVAS", this.state.stream);
      }
    }

    const videoTracks = {
      ...this.state.videoTracks,
      ["me"]: this.state.stream,
    };

    console.log("videoTracks", videoTracks);
    this.setState({
      videoTracks: videoTracks,
    });
  }

  sendAnswer = (pc: RTCPeerConnection, otherPeerid: string, offer: any) => {
    console.log("sendAnswer to: ", otherPeerid);
    pc.createAnswer(offer)
      .then(function (answer: RTCSessionDescriptionInit) {
        pc.setLocalDescription(answer);
      })
      .catch((error: any) => {
        console.log("new_pc error", error);
      });

    console.log("ADDED PEER:", otherPeerid);
    console.log("PEERs:", this.peers);
  };

  configureWS = () => {
    if (this.username.length < 1) {
      alert("Please enter a name of some kind before joining the conversation");
    } else {
      this.setState({
        connectionState: ConnectionState.connecting,
      });

      console.log("configureWS", wsEndpoint);

      ws = new WebSocket(wsEndpoint);
      ws.onopen = () => {
        console.log("WS OPEN");

        let txtjson = JSON.stringify({
          msgtype: "WSOPEN",
          clientid: this.thisId,
          username: this.username,
          confid: this.props.id,
        });
        ws.send(txtjson);
      };

      ws.onmessage = (e) => {
        let jsonData = JSON.parse(e.data);

        if ("msgtype" in jsonData) {
          if (jsonData["msgtype"] === "HOLA") {
            this.setState({
              connectionState: ConnectionState.connected,
            });
          } else if (jsonData["msgtype"] === "RTCCREATEOFFERFORPEERS") {
            console.log("RTCCREATEOFFERFORPEERS", jsonData.peers);

            Object.keys(jsonData.peers).forEach(
              (peerid: string, index: number) => {
                console.log(
                  "RTCCREATEOFFERFORPEERS start",
                  jsonData.peers[peerid]
                );
                this.start(
                  jsonData.peers[peerid].clientid,
                  jsonData.peers[peerid].username
                );
              }
            );
          } else if (jsonData["msgtype"] === "RTCANSWER") {
            console.log("RTCANSWER", jsonData);
            let answer = jsonData["answer"];

            if (jsonData.otherPeerid in this.state.rtcPeerConnections) {
              console.log(
                "set remoteDescription",
                jsonData.otherPeerid,
                answer
              );
              let peer = this.state.rtcPeerConnections[jsonData.otherPeerid];
              peer.pc.setRemoteDescription({
                sdp: answer.sdp,
                type: answer.type,
              });
              console.log(
                "set remoteDescription set for other peer",
                jsonData.otherPeerid
              );
            } else {
              console.log("set remoteDescription not");
            }
          } else if (jsonData["msgtype"] === "RTCOFFER") {
            //   console.log(e.data)
            let offerData = jsonData["offer"];
            let pc_id = offerData.id;
            let room_id = offerData.room;
            let otherPeerid = offerData.otherPeerid;
            let otherPeerUsername = offerData.username;
            let offer = offerData.offer;

            console.log(
              "OFFER RECEIVED from:",
              pc_id,
              otherPeerid,
              offer,
              otherPeerUsername
            );

            let new_pc = this.createPeerConnection(pc_id, otherPeerUsername);
            new_pc.setRemoteDescription(offer);

            new_pc.onicecandidate = (e: RTCPeerConnectionIceEvent) => {
              if (e.candidate !== null) {
                // new_pc.addIceCandidate(e.candidate);
                let candidateJson = JSON.stringify({
                  msgtype: "RTCCANDIDATE",
                  candidate: e.candidate,
                  id: pc_id,
                  room: room_id,
                  otherPeerid: otherPeerid,
                });
                console.log("send candidate");
                ws.send(candidateJson);
              } else {
                let answerJson = JSON.stringify({
                  msgtype: "RTCANSWER",
                  answer: new_pc.localDescription,
                  id: pc_id,
                  room: room_id,
                  otherPeerid: otherPeerid,
                });
                console.log("send answer");
                ws.send(answerJson);

                console.log("new_pc DONE");
              }
            };

            if (this.state.stream) {
              this.state.stream.getTracks().forEach((track) => {
                // console.log("track.getConstraints()", track.getSettings().width, track.getSettings().height)
                new_pc.addTrack(track, this.state.stream);
                console.log("add track to new peer", this.state.stream);
              });
              return this.sendAnswer(new_pc, pc_id, offer);
            }
          } else if (jsonData["msgtype"] === "REMOVEPEER") {
            console.log("received REMOVE", jsonData);

            jsonData["remove"].forEach((item: string) => {
              console.log("remove", item, Object.keys(this.peers).length);

              // Remove video track
              let videoTracks = { ...this.state.videoTracks };
              delete videoTracks[item];
              this.setState({
                videoTracks: videoTracks,
              });

              // Remove audio track
              let audioTracks = { ...this.state.audioTracks };
              delete audioTracks[item];
              this.setState({
                audioTracks: audioTracks,
              });

              // Remove peer
              delete this.peers[item];

              console.log("remove DONE", item, Object.keys(this.peers).length);
            });
          }
        }
      };
    }
  };

  createPeerConnection = (otherPeerid: string, otherPeerUsername: string) => {
    type Config = {
      sdpSemantics: string;
      iceServers: RTCIceServer[];
    };

    var config: Config = {
      sdpSemantics: "unified-plan",
      iceServers: [],
    };

    let turnServer: RTCIceServer = {
      credential: "1234",
      credentialType: "password",
      urls: "turn:videoconf.dev",
      username: "exampleuser",
    };

    if (this.state.useStun) {
      config.iceServers = [
        {
          urls: ["stun:videoconf.dev"],
        },
        {
          urls: ["stun:stun.l.google.com:19302"],
        },
        {
          urls: ["stun:stun1.l.google.com:19302"],
        },
        turnServer,
      ];
    }

    let pc = new RTCPeerConnection(config);

    let rtcPeerConnections = this.state.rtcPeerConnections;
    let peerEntry = {
      pc: pc,
      username: otherPeerUsername,
      id: otherPeerid,
    };

    rtcPeerConnections[otherPeerid] = peerEntry;

    this.setState({
      rtcPeerConnections: rtcPeerConnections,
    });

    this.peers[otherPeerid] = peerEntry;

    pc.addEventListener(
      "icegatheringstatechange",
      () => {
        // console.log("icegatheringstatechange");
        if (this.iceGatheringLog.current) {
          this.iceGatheringLog.current.textContent +=
            " -> " + pc.iceGatheringState;
        }
      },
      false
    );
    if (this.iceGatheringLog.current) {
      this.iceGatheringLog.current.textContent = pc.iceGatheringState;
    }

    pc.addEventListener(
      "iceconnectionstatechange",
      () => {
        // console.log("iceconnectionstatechange");
        if (this.iceConnectionLog.current) {
          this.iceConnectionLog.current.textContent +=
            " -> " + pc.iceConnectionState;
        }
      },
      false
    );

    if (this.iceConnectionLog.current) {
      this.iceConnectionLog.current.textContent = pc.iceConnectionState;
    }

    if (this.signalingLog.current) {
      this.signalingLog.current.textContent = pc.signalingState;
    }

    // connect audio / video
    pc.addEventListener("track", (evt) => {
      console.log("on track");
      if (evt.track.kind === "video") {
        console.log("received track video from  ", otherPeerid);

        let videoId = otherPeerid !== undefined ? otherPeerid : evt.track.id;
        // let videoTracks = this.state.videoTracks;
        // videoTracks[videoId] = evt.streams[0];

        const videoTracks = {
          ...this.state.videoTracks,
          [videoId]: evt.streams[0],
        };

        this.setState({
          videoTracks: videoTracks,
        });
      } else {
        //   console.log("track audio");
        let audioId = otherPeerid !== undefined ? otherPeerid : evt.track.id;
        if (audioId !== this.thisId) {
          // let audioTracks = this.state.audioTracks;
          // audioTracks[audioId] = evt.streams[0];

          const audioTracks = {
            ...this.state.audioTracks,
            [audioId]: evt.streams[0],
          };

          this.setState({
            audioTracks: audioTracks,
          });
        }
      }
    });

    pc.addEventListener("datachannel", (evt) => {
      console.log("datachannel!", evt);
    });

    return pc;
  };

  sendOffer = (peer: RTCPeerConnection, otherPeerid?: string) => {
    let thisThis = this;

    if (peer) {
      return peer
        .createOffer()
        .then((offer) => {
          return peer.setLocalDescription(offer);
        })
        .then(() => {
          // wait for ICE gathering to complete
          return new Promise((resolve) => {
            if (peer.iceGatheringState === "complete") {
              resolve();
            } else {
              var checkState = function () {
                if (peer.iceGatheringState === "complete") {
                  peer.removeEventListener(
                    "icegatheringstatechange",
                    checkState
                  );
                  resolve();
                }
              };

              peer.addEventListener("icegatheringstatechange", checkState);
            }
          });
        })
        .then(() => {
          var offer = peer.localDescription;
          var sdp: string = offer!.sdp;
          var codec;

          codec = thisThis.state.videoCodec;
          if (codec !== "default") {
            sdp = this.sdpFilterCodec("video", codec, sdp);
          }

          if (thisThis.offerSDPPre.current) {
            thisThis.offerSDPPre.current.textContent = sdp;
          }

          if (otherPeerid) {
            ws.send(
              JSON.stringify({
                msgtype: "RTCOFFERFORPEER",
                offer: {
                  sdp: sdp,
                  type: offer?.type,
                },
                id: this.thisId,
                username: this.username,
                otherPeerid: otherPeerid,
              })
            );
          } else {
            ws.send(
              JSON.stringify({
                msgtype: "RTCOFFER",
                offer: {
                  sdp: sdp,
                  type: offer?.type,
                },
                type: offer?.type,
                username: this.username,
                id: this.thisId,
              })
            );
          }
        });
    }
  };

  start = (otherPeerid: string, otherUsername: string) => {
    if (otherPeerid) {
      console.log(
        `START CNX FROM ${this.thisId} TO ${otherPeerid} ${otherUsername}`
      );
    } else {
      console.log(`START UP ${this.thisId} ${otherPeerid}`);
    }

    let pc = this.createPeerConnection(
      otherPeerid ? otherPeerid : this.thisId,
      otherUsername
    );
    if (otherPeerid) {
      let peer: Peer = {
        id: otherPeerid,
        pc: pc,
        username: otherUsername ? otherUsername : "",
      };
      this.peers[otherPeerid] = peer;
    }

    this.state.stream.getTracks().forEach((track) => {
      if (this.state.stream) {
        console.log("START GOT CAMERA track:", this.state.stream);
        pc.addTrack(track, this.state.stream);
      }
    });

    this.sendOffer(pc, otherPeerid);
  };

  stop = () => {
    // close data channel
    this.state.dc?.close();

    // close transceivers

    Object.keys(this.peers).forEach((keyid: string, index: number) => {
      let transceivers = this.peers[keyid].pc.getTransceivers();
      transceivers.forEach((transceiver) => {
        if (transceiver) {
          transceiver.stop();
        }
      });

      let senders = this.peers[keyid].pc.getSenders();
      senders.forEach((sender) => {
        if (sender) {
          sender.track?.stop();
        }
      });

      this.peers[keyid].pc.close();

      // Remove video track
      let videoTracks = { ...this.state.videoTracks };
      delete videoTracks[keyid];
      this.setState({
        videoTracks: videoTracks,
      });

      // Remove audio track
      let audioTracks = { ...this.state.audioTracks };
      delete audioTracks[keyid];
      this.setState({
        audioTracks: audioTracks,
      });

      // Remove peer
      delete this.peers[keyid];
    });

    ws.close();
  };

  sdpFilterCodec = (kind: string, codec: string, realSdp: string) => {
    var allowed = [];
    var rtxRegex = new RegExp("a=fmtp:(\\d+) apt=(\\d+)\r$");
    var codecRegex = new RegExp(
      "a=rtpmap:([0-9]+) " + this.escapeRegExp(codec)
    );
    var videoRegex = new RegExp("(m=" + kind + " .*?)( ([0-9]+))*\\s*$");

    var lines = realSdp.split("\n");

    var isKind = false;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("m=" + kind + " ")) {
        isKind = true;
      } else if (lines[i].startsWith("m=")) {
        isKind = false;
      }

      if (isKind) {
        var match = lines[i].match(codecRegex);
        if (match) {
          allowed.push(parseInt(match[1]));
        }

        match = lines[i].match(rtxRegex);
        if (match && allowed.includes(parseInt(match[2]))) {
          allowed.push(parseInt(match[1]));
        }
      }
    }

    var skipRegex = "a=(fmtp|rtcp-fb|rtpmap):([0-9]+)";
    var sdp = "";

    isKind = false;
    for (var j = 0; i < lines.length; j++) {
      if (lines[j].startsWith("m=" + kind + " ")) {
        isKind = true;
      } else if (lines[j].startsWith("m=")) {
        isKind = false;
      }

      if (isKind) {
        var skipMatch = lines[j].match(skipRegex);
        if (skipMatch && !allowed.includes(parseInt(skipMatch[2]))) {
          continue;
        } else if (lines[j].match(videoRegex)) {
          sdp += lines[j].replace(videoRegex, "$1 " + allowed.join(" ")) + "\n";
        } else {
          sdp += lines[j] + "\n";
        }
      } else {
        sdp += lines[j] + "\n";
      }
    }

    return sdp;
  };

  escapeRegExp = (string: string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
  };

  codecChanged = (e: string) => {
    console.log(e);
    this.setState({
      videoCodec: e,
    });
  };

  toggleVideo = async () => {
    if (this.state.videoEnabled) {
      this.setState({
        videoEnabled: false,
      });
      this.state.stream.getVideoTracks()[0].enabled = false;
      Object.keys(this.peers).forEach((keyid: string, index: number) => {
        let senders = this.peers[keyid].pc.getSenders();
        senders.forEach((sender) => {
          if (sender.track?.kind === "video") {
            sender.track.enabled = false;
          }
        });
      });
    } else {
      this.setState({
        videoEnabled: true,
      });
      this.state.stream.getVideoTracks()[0].enabled = true;
      await this.getMyCameraAndMic();
    }
  };

  toggleScreen = async () => {
    if (this.state.screenSharingEnabled) {
      this.setState({
        screenSharingEnabled: false,
      });

      if (this.state.videoEnabled) {
        this.state.stream.getVideoTracks()[0].enabled = true;
        await this.getMyCameraAndMic();
      } else {
        this.state.stream.getVideoTracks()[0].enabled = false;
      }
    } else {
      this.setState({
        screenSharingEnabled: true,
      });
      this.state.stream.getVideoTracks()[0].enabled = true;
      await this.getMyScreen();
    }
  };

  toggleAudio = async () => {
    if (this.state.audioEnabled) {
      this.setState({
        audioEnabled: false,
      });
      this.state.stream.getAudioTracks()[0].enabled = false;
      Object.keys(this.peers).forEach((keyid: string, index: number) => {
        let senders = this.peers[keyid].pc.getSenders();
        senders.forEach((sender) => {
          if (sender.track?.kind === "audio") {
            sender.track.enabled = false;
          }
        });
      });
    } else {
      this.setState({
        audioEnabled: true,
      });
      this.state.stream.getAudioTracks()[0].enabled = true;
      await this.getMyCameraAndMic();
    }
  };

  leaveConversation = () => {
    this.stop();
    this.setState({
      connectionState: ConnectionState.disconnected,
    });
  };

  nameChanged = (name: string) => {
    console.log(name);
    this.username = name;
  };

  render() {
    let videoRows: PeerVideoPlayerDictionary = {};
    let currentRow = -1;

    Object.keys(this.state.videoTracks).forEach(
      (keyid: string, index: number) => {
        if (index % this.state.totalHorizontalViews === 0) {
          currentRow += 1;
          videoRows[currentRow] = [];
        }
        let video = (
          <PeerVideoPlayer
            screenSharingEnabled={this.state.screenSharingEnabled}
            videoEnabled={this.state.videoEnabled}
            toggleAudio={this.toggleAudio}
            toggleVideo={this.toggleVideo}
            toggleScreenSharing={this.toggleScreen}
            audioEnabled={this.state.audioEnabled}
            username={
              keyid === "me" ? this.username : this.peers[keyid].username
            }
            key={keyid}
            srcVideo={this.state.videoTracks[keyid]}
            id={keyid}
          />
        );
        videoRows[currentRow].push(video);
      }
    );

    let videoplayers = Object.keys(videoRows).map(
      (key: string, index: number) => {
        return (
          <div
            style={{ padding: "0px", margin: "0px" }}
            key={guid()}
            id={key + index}
          >
            {videoRows[key].map((video, vindex) => {
              let width = 24 / this.state.totalHorizontalViews;
              width = (100 / 24) * width;

              return (
                <div
                  key={vindex}
                  style={{ width: `${width}%`, display: "inline-block" }}
                >
                  {video}
                </div>
              );
            })}
          </div>
        );
      }
    );

    let audioplayers = Object.keys(this.state.audioTracks).map((key) => {
      return (
        <PeerAudioPlayer
          srcAudio={this.state.audioTracks[key]}
          key={key}
          id={key}
        />
      );
    });

    let conflink = `${window.location.origin.toString()}/conf/${this.props.id}`;

    let connectionButton;

    switch (this.state.connectionState) {
      case ConnectionState.connected:
        connectionButton = (
          <Button
            style={{
              backgroundColor: "#f40000",
              borderColor: "#f40000",
            }}
            block
            type="primary"
            size="large"
            onClick={this.leaveConversation}
          >
            Leave chat
          </Button>
        );
        break;
      case ConnectionState.connecting:
        connectionButton = (
          <Button
            style={{
              backgroundColor: "#f44400",
              borderColor: "#f44400",
            }}
            block
            type="primary"
            size="large"
            onClick={() => console.log("connecting...")}
          >
            Connecting...
          </Button>
        );
        break;
      case ConnectionState.disconnected:
        connectionButton = (
          <Button
            style={{
              backgroundColor: "#1890ff",
              borderColor: "#1890ff",
            }}
            block
            type="primary"
            size="large"
            onClick={this.configureWS}
          >
            Join chat
          </Button>
        );
        break;
    }

    return (
      <div
        style={{ display: "flex", flexDirection: "column", overflow: "scroll" }}
      >
        <Prompt
          when={true}
          message={(location) => `Are you sure you want to leave?`}
        />

        <div
          style={{
            maxHeight: "100vh",
            overflowY: "scroll",
            paddingRight: "20px",
            paddingTop: "10px",
          }}
        >
          <Row gutter={[8, 8]} style={{ paddingBottom: "12px" }}>
            <Col xs={24} sm={6}>
              <Input
                size="large"
                onChange={(e) => this.nameChanged(e.target.value)}
                placeholder="Enter your name"
              />
            </Col>
            <Col xs={24} sm={6}>
              {connectionButton}
            </Col>
            <Col xs={24} sm={6}></Col>
            <Col xs={24} sm={6}>
              <Select
                style={{ minWidth: "100%", float: "right" }}
                placeholder="#videos horizontally"
                onChange={(value: number) => {
                  this.setState({
                    totalHorizontalViews: value,
                  });
                }}
              >
                <Option value="1">1</Option>
                <Option value="2">2</Option>
                <Option value="3">3</Option>
                <Option value="4">4</Option>
                <Option value="5">5</Option>
                <Option value="6">6</Option>
                <Option value="7">7</Option>
                <Option value="8">8</Option>
                <Option value="9">9</Option>
                <Option value="10">10</Option>
                <Option value="11">11</Option>
                <Option value="12s">12</Option>
              </Select>
            </Col>
          </Row>

          <Row
            style={{
              paddingTop: "4px",
              paddingBottom: "4px",
            }}
          >
            Conf Link: <a href={conflink}>{conflink}</a>
          </Row>

          <canvas
            style={{ width: "320px", height: "180px", display: "none" }}
            ref={this.canvasRef}
          />
        </div>

        <div>
          <div
            id="videos"
            style={{
              width: "100%",
              maxHeight: "calc(100vh - 60px)",
              paddingRight: "10px",
              overflowY: "scroll",
            }}
          >
            {audioplayers}
            {videoplayers}
          </div>
        </div>
        <div style={{ display: this.state.debugEnabled ? "" : "none" }}>
          <h2>Debugging</h2>

          <p>PeerId - {this.thisId}</p>
          <p>
            ICE gathering state:{" "}
            <span ref={this.iceGatheringLog} id="ice-gathering-state"></span>
          </p>
          <p>
            ICE connection state:{" "}
            <span ref={this.iceConnectionLog} id="ice-connection-state"></span>
          </p>
          <p>
            Signaling state:{" "}
            <span ref={this.signalingLog} id="signaling-state"></span>
          </p>

          <h2>SDP</h2>

          <h3>Offer</h3>
          <pre ref={this.offerSDPPre} id="offer-sdp"></pre>

          <h3>Answer</h3>
          <pre ref={this.answerSDPPre} id="answer-sdp"></pre>
        </div>
      </div>
    );
  }
}

export default PeerVideo;
