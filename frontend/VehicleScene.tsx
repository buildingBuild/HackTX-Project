import {useEffect,useRef,useState,type RefObject} from 'react';
import '@google/model-viewer';
import type {ModelViewerElement} from '@google/model-viewer';
import {ArrowDown,ArrowRight,Check,CheckCircle2,LoaderCircle,RotateCcw,Volume2,VolumeX} from 'lucide-react';
import {oilCheckSteps} from './repair-guide';

export type ScanPhase='idle'|'connecting'|'scanning'|'complete'|'opening'|'guide';
type Props={phase:ScanPhase;level?:number;code?:string|null;progress:number;guideStep:number;guideDone:boolean;confirmed:boolean;voice:boolean;onConfirm:(value:boolean)=>void;onNext:()=>void;onBack:()=>void;onVoice:()=>void;onReplay:()=>void;onReady:(ready:boolean)=>void;onHoodOpened:()=>void;viewer:RefObject<ModelViewerElement|null>};
export default function VehicleScene(props:Props){
 const {phase,level,progress,guideStep,viewer}=props;
 const [loaded,setLoaded]=useState(false),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0),[download,setDownload]=useState(0),[inAR,setInAR]=useState(false);
 const latest=useRef(props);latest.current=props;
 const step=oilCheckSteps[guideStep];
 useEffect(()=>{
  const element=viewer.current;if(!element)return;
  const onLoad=()=>{setLoaded(true);setFailed(false);latest.current.onReady(true);};
  const onError=()=>{setFailed(true);setLoaded(false);latest.current.onReady(false);};
  const onProgress=(event:Event)=>setDownload(Math.round((event as CustomEvent<{totalProgress:number}>).detail.totalProgress*100));
  const onFinished=()=>{if(latest.current.phase==='opening')latest.current.onHoodOpened();};
  const onAR=(event:Event)=>setInAR(['session-started','object-placed'].includes((event as CustomEvent<{status:string}>).detail.status));
  const onSelect=(event:Event)=>{if(event.target instanceof Element&&event.target.closest('button,label,input'))event.preventDefault();};
  element.addEventListener('load',onLoad);element.addEventListener('error',onError);element.addEventListener('progress',onProgress);element.addEventListener('finished',onFinished);element.addEventListener('ar-status',onAR);element.addEventListener('beforexrselect',onSelect);
  if(element.loaded)onLoad();
  return()=>{element.removeEventListener('load',onLoad);element.removeEventListener('error',onError);element.removeEventListener('progress',onProgress);element.removeEventListener('finished',onFinished);element.removeEventListener('ar-status',onAR);element.removeEventListener('beforexrselect',onSelect);};
 },[viewer,attempt]);
 useEffect(()=>{
  const element=viewer.current;if(!loaded||!element)return;
  // Three's mixer cannot seek a paused action: briefly unpause before seeking,
  // and stay just inside the endpoint to avoid wrapping an exhausted action.
  const seek=(time:number)=>{element.play({repetitions:1,pingpong:false});element.currentTime=Math.min(time,Math.max(0,element.duration-.0001));element.pause();};
  if(phase==='opening'){
   seek(0);
   if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){seek(element.duration);latest.current.onHoodOpened();}
   else element.play({repetitions:1,pingpong:false});
  }else if(phase==='guide'){
   if(element.currentTime<element.duration-.01)seek(element.duration);
   else element.pause();
  }else seek(0);
 },[phase,loaded,viewer]);
 const scanActive=phase==='connecting'||phase==='scanning';
 return <div className={`vehicle-stage ${scanActive?'scan-active':''} ${phase==='guide'?'hood-view':''}`}>
  <div className="stage-grid" aria-hidden="true"/><div className="stage-wordmark" aria-hidden="true">LAND CRUISER</div>
  <div className="stage-topline"><span><i className={scanActive?'status-dot pulse':'status-dot'}/>{phase==='connecting'?'ESTABLISHING CONNECTION':phase==='scanning'?'DIAGNOSTIC SWEEP':phase==='opening'?'OPENING ENGINE HOOD':phase==='guide'?'GUIDED REPAIR VIEW':'VEHICLE VISUALIZATION'}</span><span>LC300 / 01</span></div>
  <model-viewer key={attempt} ref={viewer} className="diagnostic-model" src="/models/land-cruiser-300-animated.glb" alt="Interactive Land Cruiser training model. The hood opens for the oil-level walkthrough. Component markers are approximate training areas." camera-controls camera-orbit={phase==='guide'?step.orbit:'32deg 70deg 8.1m'} camera-target={phase==='guide'?step.target:'0 1.05 0.2'} field-of-view="32deg" min-camera-orbit="auto 10deg 1.5m" max-camera-orbit="auto 89deg 14m" environment-image="neutral" exposure="0.85" shadow-intensity="0.6" shadow-softness="1" interaction-prompt="none" touch-action="pan-y" loading="eager" animation-name="HoodOpen" ar ar-modes="webxr">
   <span slot="progress-bar"/><span slot="ar-button"/>
   {loaded&&phase==='complete'&&<div slot="hotspot-finding" className={`finding-marker severity-${level}`} data-position="0 1.35 1.85" data-normal="0 1 0"><span className="marker-label"><i/>{props.code??'SERVICE CHECK'}<b>LEVEL {level}</b></span><span className="marker-stem"/><span className="marker-dot"/></div>}
   {loaded&&phase==='guide'&&!props.guideDone&&<div key={step.id} slot={`hotspot-${step.id}`} className="guide-marker" data-position={step.position} data-normal="0 1 0"><span>{String(guideStep+1).padStart(2,'0')}<b>{step.marker}</b></span><ArrowDown size={34}/><i/></div>}
   <div className="xr-guide" aria-hidden={!inAR}>
    <p className="xr-placement">Move your phone to find a surface, then place the car. Markers identify training areas; confirm the dipstick in your manual.</p>
    <div className="xr-instructions">{props.guideDone?<><CheckCircle2/><h3>Oil-level walkthrough complete</h3><p>Review your actual dipstick reading before driving.</p></>:<><small>LEVEL 1 / STEP {guideStep+1} OF 5</small><h3>{step.title}</h3><p>{step.instruction}</p><div className="guide-audio"><button onClick={props.onVoice}>{props.voice?<Volume2 size={16}/>:<VolumeX size={16}/>}Voice {props.voice?'on':'off'}</button><button onClick={props.onReplay}>Read step aloud</button></div><label className="step-confirm"><input type="checkbox" checked={props.confirmed} onChange={e=>props.onConfirm(e.target.checked)}/>{step.confirmation}</label><div className="guide-buttons"><button className="btn ghost" onClick={props.onBack} disabled={!guideStep}>Back</button><button className="btn red" onClick={props.onNext} disabled={!props.confirmed}>{guideStep===4?'Finish check':'Next step'}<Check size={15}/></button></div></>}</div>
   </div>
  </model-viewer>
  {scanActive&&<div className="scan-sweep" aria-hidden="true" style={{left:`${12+progress*.76}%`}}><div/></div>}
  {!loaded&&<div className="model-loading" role="status">{failed?<><span>3D preview unavailable</span><button onClick={()=>{setFailed(false);setAttempt(a=>a+1);}}><RotateCcw size={14}/>Reload model</button></>:<><LoaderCircle size={18} className="spin"/><span>Loading Land Cruiser <b>{download}%</b></span></>}</div>}
  <div className="stage-bottomline"><span>{phase==='guide'?'LC300 BODY + HDJ100 ENGINE SCAN · TRAINING REFERENCE':'LAND CRUISER 300 / TRAINING VEHICLE'}</span><span>DRAG TO ROTATE <ArrowRight size={12}/></span></div>
 </div>;
}
