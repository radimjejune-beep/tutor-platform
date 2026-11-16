import {createContext,useContext} from 'react';
import {api} from '../api';
export const ActivityMediaContext=createContext(api.fileBlob);
export const useActivityMedia=()=>useContext(ActivityMediaContext);
