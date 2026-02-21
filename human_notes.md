1. ai search tool mentions  type: "string",
                            description: "Scale quality: major, minor, dorian, phrygian, lydian, mixolydian, locrian, dominant7, minor7, major7, diminished, augmented",
                        }, 
but db currently only contains major and minor

2. filter by module missing some module types 
 module_type: {
                            type: "string",
                            enum: ["scale", "arpeggio", "rhythm", "chord_progressions"],
                            description: "Filter by module type",
                        },

3. the primary philosophy of this tool is really 2 things
    1. there are certain specific pillars of guitar playing that we want to continuously progress on day after day, this is why this practice tool has modules for each of the most important pilars, and guides the user to practice daily, keeping track of where they were last time, and always giving a slight nudge in progress, ideally so that the user is free to customize to where they are currently challenged, and regardless of the module, it will record where they are and continue tracking progress on that one skill.  The ai coach should be well informed on this strategy and guide the user towards it.
    2. We want to be as aware as humanly possible of each note we're playing.  Guitarists tend to have the weakest ears of any musicians, this is because they can easily learn scale shapes, and then they can play within a key, but which exact note they are playing is not as clear, it is far too easy to just play the whole scale shape.  Unlike otehr instruments like piano, where you need to know how many sharps are in a key.  Therefore we want to be as aware as possible of each note we're playing, it's function (1-7) within the key context.  Therefore it is paramount to always pay attention to this marking which is there in every single exercise on this site, and pay special attention to the notewalking exerccise, which is an exercise where pedal notes play switching between two chords, the user's job is to practice walking on chord tones of the two chords and changing when the pedal notes change.  