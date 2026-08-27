# Qualitative Supplementary Package

This reviewer-facing package documents the qualitative component of a mixed-methods VR locomotion study. It combines the qualitative methods, analytical procedure, robustness checks, limitations, and approved qualitative results in a single document.

## Supporting Files

The accompanying anonymized data files are:

- `corpus_summary.csv`: source-level corpus inventory and quotation-eligibility status.
- `codebook.csv`: researcher-approved code definitions and coding boundaries.
- `coding_matrix_anonymized.csv`: excerpt-free segment-level assignments using anonymized identifiers and structured attributes.
- `theme_summary.csv`: definitions, scope, approved quotation links, qualifying cases, and quantitative connections for the four themes.
- `quotation_audit.csv`: traceability for the eight researcher-approved publication quotations.
- `quant_qual_integration.csv`: joint display linking qualitative themes to statistics regenerated from the final quantitative notebook outputs.
- [`study_questionnaire.md`](../quantitative_supplement/study_questionnaire.md): documentation of the study questions and response formats, distributed with the quantitative materials.

## Confidentiality Boundary

The package contains no raw audio, raw full transcripts, internal site names, local paths, internal filenames or hashes, or direct identifiers. Sites and participants are represented only by stable public identifiers in the form `SITE1/Pxx` and `SITE2/Pxx`. Only the eight translated quotations specifically approved for publication are included.

---

# Qualitative Methods

## Data Collection and Corpus

After completing all three method blocks, participants took part in an approximately five-minute semi-structured interview. The same five-question guide was used at both study sites, with interviews conducted by experimenters who are co-authors of the paper. The qualitative corpus contains a record for all 42 participants.

For 37 participants, interviews were audio-recorded in the participants' mother tongues. Five participants at SITE2 declined audio recording; for these participants, the corpus contains structured contemporaneous notes covering Q1--Q5 and preserving explicitly recorded semantic content.

The post-condition questionnaire additionally contained one optional free-text item for each technique. Substantive responses were analyzed as a separate, method-specific qualitative source.

### Semi-Structured Interview Guide

The final interview guide comprised the following questions:

1. **Q1:** Which locomotion method felt most natural, and why?
2. **Q2:** Which locomotion method made it easiest to maintain directional awareness, and why?
3. **Q3:** Did any locomotion technique feel particularly confusing, unintuitive, or disorienting?
4. **Q4:** Imagine using these locomotion techniques in different VR applications. What kinds of tasks or situations would each technique be best suited for?
5. **Q5:** Do you have any additional comments or observations about the locomotion techniques?

## Analytical Approach

We analyzed the qualitative data using the Framework Method \cite{gale2013framework}, with a combined deductive--inductive analytical strategy. The deductive organization reflected the three research-question domains: practical viability (RQ1), spatial awareness (RQ2), and usability trade-offs (RQ3). In parallel, an open inductive branch was retained to capture meanings not adequately represented by these predefined domains.

The analysis followed the main stages of the Framework Method: familiarization with the corpus, initial coding, development of a working analytical framework, application of that framework to the full corpus, charting into a framework matrix, and interpretation across and within cases. A stratified pilot sample of ten participants was first segmented into meaning units and used to develop and refine the working codebook, including code definitions, scope, inclusion and exclusion criteria, and relevant coding attributes. The resulting analytical framework was then applied to the full corpus.

Coding was restricted to explicit participant semantic content matching the relevant code definition. Unstated mechanisms were not inferred, conceptually distinct constructs were kept separate, and experimenter speech and administrative material were excluded. Code-specific meanings and scope are defined in `codebook.csv`; the shared inclusion and exclusion criteria were applied together with these definitions rather than repeated for every code. Repeated evidence from the same participant expressing the same meaning about the same technique was linked and collapsed in participant-level summaries.

Coded material was charted into a framework matrix organized by participant and technique, enabling comparison both within individual participants and across participants and techniques. Ambiguous passages, translation uncertainties, speaker-role exceptions, duplicate evidence appearing in both interviews and questionnaire comments, and candidate meanings not adequately represented by the existing analytical framework were reviewed during full-corpus coding. Where warranted, the framework was refined to accommodate meanings identified inductively.

Following full-corpus review, related codes and categories were consolidated into four higher-level themes. Theme development considered patterns across the complete corpus as well as negative cases and differences associated with source type or study site.

## AI-Assisted Processing and Researcher Oversight

AI-supported tools served distinct functions at different stages of corpus preparation and analysis. For the 37 recorded interviews, 11Labs speech-to-text produced the initial transcripts in the participants' mother tongues. Google Gemini 3.6 then translated these transcripts into English. The translated transcripts were lightly cleaned to remove fillers such as “ehm” or “hmm,” humming, and experimenter acknowledgments that did not contribute participant semantic content. One study researcher subsequently verified each English transcript against the original audio and corrected identified transcription or translation errors where necessary.

OpenAI Codex using the Sol 5.6 model assisted with corpus auditing, participant-speech segmentation, preliminary coding suggestions, candidate-theme organization, consistency and sensitivity checks, quotation-audit preparation, and construction of the mixed-methods joint display.

All AI-generated analytical outputs were treated as provisional. One study researcher manually reviewed the source material, revised or rejected coding suggestions, resolved ambiguous cases, supplied corrections concerning the evaluated implementation where needed, and approved the final codebook, coding decisions, themes, interpretations, and eight quotations reported in the paper. AI was therefore used as an analytical support tool rather than as an independent coder. The researcher retained final analytical responsibility, and the authors retain responsibility for all reported qualitative findings.

The five records created for participants who declined audio recording consisted of contemporaneous non-verbatim notes. They contributed to coding and thematic analysis but were excluded from the quotation pool because their wording could not be verified against audio.

## Mixed-Methods Integration and Robustness

Qualitative coding was conducted separately from the quantitative analysis. Integration was performed subsequently through a joint display linking the qualitative themes to quantitative measures of route time, interaction count, path efficiency, landing error and corrective action, phase-specific head movement, perceived spatial awareness and continuity, workload, usability, preference, and cybersickness. Relationships between qualitative and quantitative evidence were characterized as convergence, complementarity, divergence, or expansion.

Qualitative evidence was used to contextualize and explain observed quantitative patterns rather than to alter their statistical interpretation. In particular, qualitative reports were not used to interpret non-significant effects as evidence of equivalence, head movement as a direct measure of cognitive effort, perceived spatial awareness as acquired spatial knowledge, preference as usability, or implementation-specific problems as inherent limitations of a locomotion technique.

Sensitivity checks examined whether the thematic interpretation depended on particular components of the corpus. Findings from the complete integrated corpus were compared with analyses restricted to **audio-transcript cases only**, interview-only evidence, questionnaire-only evidence, each study site, and evidence with versus without implementation-related attribution. All four themes remained represented after removing the five note-based interview records. These checks were used to assess the robustness of the interpretation to source composition and study context; they should not be interpreted as evidence of theoretical saturation.

## Limitations

The qualitative component was designed primarily to contextualize the controlled experiment and help interpret the quantitative findings rather than to constitute a standalone qualitative study. The analysis was conducted by one human researcher with AI-assisted preprocessing and analytical support. No independent double coding, intercoder reliability or agreement statistic, member checking, or formal assessment of theoretical saturation was performed, and no causal inference is made from the qualitative evidence.

Source fidelity differed across the corpus. Most participant records were derived from audio recordings that underwent automated transcription, machine translation, researcher verification, and light cleaning, whereas five participants were represented by contemporaneous non-verbatim notes. Automated transcription and translation may alter linguistic nuance despite verification against the recordings, and note-based records necessarily preserve less linguistic detail than audio-derived transcripts.

The interviews were brief and structured around the evaluated locomotion techniques and research questions. They therefore provide explanatory evidence about participants' experiences within this experiment rather than the depth or breadth expected from a standalone qualitative inquiry. Counts of participants expressing a code, category, or theme describe patterns within this corpus and should not be interpreted as population-level prevalence.

Finally, researcher review reduces but does not eliminate errors or interpretive bias introduced through automated transcription, translation, AI-assisted coding suggestions, heterogeneous source material, or confirmation bias. The use of a single human analyst also limits the independence with which interpretive decisions were assessed.

---

# Qualitative Results

The analysis retained four recurring themes. Quotations are translated, researcher-verified English renderings.

## 1. Locomotion Suitability Was Conditional on Spatial Scale and Task Context

Participants described Baseline as useful for short, local, or route-relevant movement; Minimap as direct long-range relocation when the intervening environment mattered less; and Tsunami as medium- or long-range traversal that retained more first-person context. “If I have to move over short distances, then definitely Baseline. There is basically no question about that for me.” (SITE2/P16). “For short distances, I would choose Baseline; for medium to longer distances, Tsunami.” (SITE1/P10). This recurring pattern converged with the long-range time reductions and method-by-route interactions, while teleport count and path efficiency showed that the techniques achieved efficiency differently. It does not establish one universally optimal technique.

## 2. Spatial Awareness Depended on the Representation Kept Perceptually Available

Minimap supplied a global symbolic overview but could shift attention away from the surrounding 3D environment; Tsunami retained a first-person preview of the destination area. “With the Minimap, you were completely detached from the surrounding space in the game.” (SITE2/P17). “I could also see more of the surrounding area, including streets. Suddenly, I was able to orient myself much better.” (SITE1/P12). The pattern converged with higher subjective spatial-awareness and continuity ratings for Tsunami, but the phase-specific movement measures were more complex. Minimap sometimes supported useful global orientation, and Tsunami did not always help when landmarks or targets were unclear. Head movement is treated only as a behavioral proxy, not direct evidence of cognitive orientation or acquired spatial knowledge.

## 3. Observed Usability Reflected Concept, Interaction Mapping, and Implementation

Participants distinguished, explicitly or through the problems they described, between a locomotion principle and the way it was controlled and implemented. “If the jitter were damped or smoothed a little more, it could also work quite well for precise movement over shorter distances.” (SITE2/P03). “When I released the joystick to teleport, it moved slightly and sent me to a somewhat different location from the one I had selected.” (SITE1/P10). Minimap showed better landing precision in the tested long-range configuration, while Tsunami more often involved sequential correction. Joystick-release confirmation, elementary filtering, fixed map parameters, unavailable zoom, and UI placement are configurable prototype choices. Alternative mappings are design hypotheses, not effects tested here, and participant quotations do not prove their causal impact.

## 4. Practical Adoption Depended on Learnability, Coherence, and Demonstrated Utility

Prior familiarity aided Baseline, while both long-range techniques could initially feel unfamiliar. Several participants nevertheless described rapid functional acclimatization. “The Minimap was a little difficult at first, but once you got the hang of it, it actually worked quite well. Once it clicked, it was quite easy.” (SITE2/P09). “Tsunami was very straightforward and produced a good result. I personally liked it. It was relatively easy to use, especially for the tasks themselves, and I had no problems with it.” (SITE2/P17). This contextualized the within-method reductions in next-aim latency and head rotation. It did not establish universal mastery or a difference in learning rate. Tsunami's novelty and appeal were practically relevant only insofar as they co-occurred with task utility, lower observed workload, higher usability, and preference; Minimap's lower preference did not negate its speed and precision advantages.

## Integrated Interpretation

Minimap and Tsunami were viable but distinct long-range strategies. Minimap prioritized directness, active-traversal speed, and landing precision. Tsunami combined a large efficiency improvement over Baseline with stronger perceived spatial continuity and greater preference. The qualitative evidence explains and qualifies these trade-offs for the evaluated implementations; it does not independently establish the causal mechanisms underlying the quantitative differences.
