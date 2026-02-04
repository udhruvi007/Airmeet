import React, {useEffect, useState, useRef } from 'react';
import io from "socket.io-client";
import "../styles/VideoComponent.css";
import { Badge, IconButton, TextField } from '@mui/material';
import { Button } from '@mui/material';


const server_url = "http://localhost:8000";
var connections = {};

const peerConfigConnections = {
   "iceServers": [
    {"urls": "stun:stun.l.google.com:19302"}
   ]
}


function VideoMeetComponent() {
  var socketRef = useRef();
  let socketIdRef = useRef();

  let localVideoRef = useRef();

  let [videoAvailable,setVideoAvailable] = useState(true);
  
  let [audioAvailable,setAudioAvailable] = useState(true);
  
  let [video,setVideo] = useState(); 

  let [audio,setAudio] = useState();

  let [screen, setScreen] = useState();

  let [showModal, setModal] = useState();

  let [screenAvailable, setScreenAvailable] = useState();
  
  let [messages, setMessages] = useState();

  let [message, setMessage] = useState("");

  let [newMessages, setNewMessages] = useState(0);

  let [askForUsername, setAskForUsername] = useState(true);

  let [username, setUsername] =useState("");

  const videoRef = useRef([])

  let [videos, setVideos] = useState([])


  // if(isChrome()===false){

  // }
  
  const getPermission = async () => {
    try{
     const videoPermission = await navigator.mediaDevices.getUserMedia({video:true})
    if(videoPermission){
      setVideoAvailable(true);
    }else{
      setVideoAvailable(false);
    }
     const audioPermission = await navigator.mediaDevices.getUserMedia({audio:true})
    if(audioPermission){
      setAudioAvailable(true);
    }else{
      setAudioAvailable(false);
    }
    if(navigator.mediaDevices.getDisplayMedia){
      setScreenAvailable(true);
    }else{
      setScreenAvailable(false);
    }
    if(videoAvailable || audioAvailable){
      const userMediaStream = await navigator.mediaDevices.getUserMedia({video:videoAvailable,audio:audioAvailable})
      if(userMediaStream){
        window.localStream = userMediaStream;
        if(localVideoRef.current){
         localVideoRef.current.srcObject = userMediaStream;
        }
      }
    }

    }catch(err){
      console.error(err);

    }
  };
  
  useEffect(() => {
  getPermission();
}, []);

let getUserMediaSuccess = (stream) => {

}




let getUserMedia = () => {
  if((video && videoAvailable) || (audio && audioAvailable)){
    navigator.mediaDevices.getUserMedia({video: video, audio:audio})
  .then(getUserMediaSuccess)
  .then((stream)=>{})
  .catch((e)=>console.log(e))
  }else{
    try{
    let tracks = localVideoRef.current.srcObject.getTracks();
    tracks.forEach(track => track.stop())
    }catch(e){

    }
  }
}

useEffect(() => {
  if(video !== undefined && audio !== undefined){
    getUserMedia();
    console.log("SET STATE HAS", video, audio);
  }
},[video,audio])
let getMedia = () => {
  setVideo(videoAvailable);
  setAudio(audioAvailable);
  // connectToSocketServer();
}
let connect = () => {
        setAskForUsername(false);
        getMedia();
    }
  return (
    <div>
      {askForUsername === true ?
    <div>
     
      <h2>Enter into Lobby</h2>
       <TextField id="outlined-basic" label="Username" value={username} onChange={e => setUsername(e.target.value)} variant="outlined" />
       <Button variant="contained" onClick={connect}>Connect</Button>


   <div>
    <video ref={localVideoRef} autoPlay muted></video>
   </div>

      </div> : <> </>
    }
    </div>
  ) 
}

export default VideoMeetComponent