import type {DetailedHTMLProps,HTMLAttributes} from 'react';
import type {ModelViewerElement} from '@google/model-viewer';
declare module 'react' {
 namespace JSX {interface IntrinsicElements {
  'model-viewer':DetailedHTMLProps<HTMLAttributes<ModelViewerElement>,ModelViewerElement>&{src:string;alt:string;ar?:boolean;[attribute:string]:unknown};
 }}
}
