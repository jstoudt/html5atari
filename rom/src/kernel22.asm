; '2600 for Newbies
; Session 21 - Sprites
; This kernel draws a simple box around the screen border
; Introduces sprites


                processor 6502
                include "vcs.h"
                include "macro.h"


                SEG.U vars
                ORG $80

SpriteXPosition ds 1



;------------------------------------------------------------------------------

                SEG code
                ORG $F000

Reset

        ; Clear RAM and all TIA registers

                ldx #0 
                lda #0 
Clear           sta 0,x 
                inx 
                bne Clear

                ldx #$FF
                txs

        ;------------------------------------------------
        ; Once-only initialisation...

                lda #$02
                sta COLUBK              ; set the background color

                lda #$45
                sta COLUPF              ; set the playfield colour
                
                lda #$56
                sta COLUP0
                lda #$67
                sta COLUP1

                lda #%00000001
                sta CTRLPF              ; reflect playfield

        ;------------------------------------------------

StartOfFrame

    ; Start of new frame
    ; Start of vertical blank processing

                lda #0
                sta VBLANK

                lda #2
                sta VSYNC

                sta WSYNC
                sta WSYNC
                sta WSYNC                ; 3 scanlines of VSYNC signal

                lda #0
                sta VSYNC
                
        ;------------------------------------------------
        ; 37 scanlines of vertical blank...
            
                ldx #0
VerticalBlank   sta WSYNC
                inx
                cpx #37
                bne VerticalBlank



        ;------------------------------------------------
        ; Do 192 scanlines of colour-changing (our picture)

                ldx #0                  ; this counts our scanline number

                lda #%11111111
                sta PF0
                sta PF1
                sta PF2

                ; We won't bother rewriting PF0-PF2 every scanline of the
                ; top 8 lines - they never change!

Top8Lines       sta WSYNC
                inx
                cpx #8                  ; are we at line 8?
                bne Top8Lines           ; No, so do another

                ; Now we want 178 lines of "wall"

                lda #%00010000          ; PF0 is mirrored <--- direction,
                                        ; low 4 bits ignored
                sta PF0
                lda #0
                sta PF1
                sta PF2

                ; again, we don't bother writing PF0-PF2 every
                ; scanline - they never change!

                sta WSYNC

                ; Now adjust the sprite position

                inc SpriteXPosition
                ldx SpriteXPosition
                cpx #160
                bcc LT160
                ldx #0
                stx SpriteXPosition
LT160
                jsr PositionSprite

MiddleLines     
                stx GRP0                ; modify sprite 0 shape
                stx GRP1

                sta WSYNC
                inx

                cpx #184
                bne MiddleLines

                    ; Finally, our bottom 8 scanlines - the same as the top 8
                    ; AGAIN, we aren't going to bother writing PF0-PF2
                    ; mid-scanline!

                lda #%11111111
                sta PF0
                sta PF1
                sta PF2

Bottom8Lines    sta WSYNC
                inx
                cpx #192
                bne Bottom8Lines

        ;------------------------------------------------

 
                lda #%01000010
                sta VBLANK           ; end of screen - enter blanking

    ; 30 scanlines of overscan...

                ldx #0
Overscan        sta WSYNC
                inx
                cpx #30
                bne Overscan

                jmp StartOfFrame



Divide15
.POS	SET 0
	REPEAT 256
	.byte (.POS / 15) + 1
.POS	SET .POS + 1
	REPEND

PositionSprite

                sta WSYNC

            ; Pass X register holding desired X position of sprite!

		        lda Divide15,x			; xPosition / 15
		        tax
SimpleLoop	    dex
		        bne SimpleLoop

		        sta RESP0			; start drawing the sprite
                rts



;------------------------------------------------------------------------------

            ORG $FFFA

InterruptVectors

            .word Reset           ; NMI
            .word Reset           ; RESET
            .word Reset           ; IRQ

    		END

