program Mini1Program

actor MiniActor is RuntimeEntity begin

    image Elefant2 "0.png"
    image Elefant1 "1.svg"

    script on startup do begin
        if getGraphicIndexById("Elefant1") = 1 then begin
        end else begin
            _RUNTIME_signalFailure()
        end
    end

end

