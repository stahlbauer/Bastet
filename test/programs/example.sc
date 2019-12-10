program ExampleProgram

actor Stage is ScratchStage begin
    image backdrop1 "file://back1.png"
    image backdrop2 "file://back2.png"
    sound sound1 "file://sound1.wav"

    declare variable1 as number
    declare variable2 as string
    declare variable3 as list string

    set attribute "x" to 10
    set attribute "y" to 5

    set variable3 to [ "foo", "bar", "wauz" ]

    script on startup do begin
        set variable1 to 1
    end
end

actor Test is ScratchSrpite begin
    image backdrop1 "file://back1.png"
    image backdrop2 "file://back2.png"
    sound sound1 "file://sound1.wav"

    declare variable1 as number
    declare variable2 as string
    declare variable3 as list string

    set attribute "x" to 10
    set attribute "y" to 5

    set variable3 to [ "foo", "bar", "wauz" ]

    script on startup do begin
        set variable1 to 1
    end
end

actor Sprite1 is ScratchSprite begin
    script on startup do begin
        say "Hello World"
        if true then begin
            say "Hello World again!"
        end
    end
end

actor Sprite2 is ScratchSprite begin
    define foo (n: number, m: number) begin
        say as string (n + m)
    end

    script on startup do begin
        say "Hello again!"
        foo(1, 41)
    end
end
