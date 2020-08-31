import React from "react";
import { useParams } from "react-router-dom";
import PeerVideo from "../components/PeerVideo";

// TODO make not found generic component
const Conf = () => {
  const { id } = useParams();
  console.log("confId", id);
  return (
    <div style={{ paddingLeft: "10px" }}>
      {id ? <PeerVideo id={id} /> : <p>"not found"</p>}
    </div>
  );
};

export default Conf;
