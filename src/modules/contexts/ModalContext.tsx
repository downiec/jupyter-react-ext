import React, { forwardRef, useImperativeHandle, Ref } from "react";

type Action =
  | { type: "showModal"; modalID: string }
  | { type: "hideModal" }
  | { type: "toggleModal"; modalID: string };
type Dispatch = (action: Action) => void;
type ModalProviderProps = { children: React.ReactNode };

interface IModalProviderRef {
  state: State;
  dispatch: Dispatch;
}

type State = {
  modalOpen: string | null;
};

const initialState: State = {
  modalOpen: null,
};

function appReducer(state: State, action: Action): State {
  switch (action.type) {
    case "showModal": {
      return { ...state, modalOpen: action.modalID };
    }
    case "hideModal": {
      return { ...state, modalOpen: "none" };
    }
    case "toggleModal": {
      if (state.modalOpen === "none") {
        return { ...state, modalOpen: action.modalID };
      } else {
        return { ...state, modalOpen: "none" };
      }
    }
    default: {
      return state;
    }
  }
}

const ModalStateContext = React.createContext<State | undefined>(undefined);
const ModalDispatchContext = React.createContext<Dispatch | undefined>(
  undefined
);

// eslint-disable-next-line react/display-name
const ModalProvider = forwardRef(
  (
    { children }: ModalProviderProps,
    ref: Ref<IModalProviderRef>
  ): JSX.Element => {
    const [state, dispatch] = React.useReducer(appReducer, initialState);

    useImperativeHandle(ref, () => ({ state, dispatch }));

    return (
      <ModalStateContext.Provider value={state}>
        <ModalDispatchContext.Provider value={dispatch}>
          {children}
        </ModalDispatchContext.Provider>
      </ModalStateContext.Provider>
    );
  }
);

function useModalState(): State {
  const context = React.useContext(ModalStateContext);
  if (context === undefined) {
    throw new Error("useAppState must be used within AppProvider");
  }
  return context;
}

function useModalDispatch(): Dispatch {
  const context = React.useContext(ModalDispatchContext);
  if (context === undefined) {
    throw new Error("useAppDispatch must be used within a AppProvider");
  }
  return context;
}

function useModal(): [State, Dispatch] {
  return [useModalState(), useModalDispatch()];
}

export { ModalProvider, IModalProviderRef, useModal, Action };
