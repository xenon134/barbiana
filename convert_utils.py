def convert_to_vtt(subs_file):
    import subprocess as sp
    import os
    outfile = os.path.join('public', 'temp_subs.vtt')
    sp.Popen(['ffmpeg.exe', '-hide_banner', '-i', subs_file, '-y', outfile], stdin=sp.DEVNULL).wait()
    return outfile

def convert_to_vtt_bytes(subs_file):
    import subprocess as sp
    proc = sp.Popen(['ffmpeg.exe', '-hide_banner', '-i', subs_file, '-y', '-'], stdin=sp.DEVNULL, stdout=sp.PIPE)
    return proc.stdout.read()


def extract_subtitles(video_file):
    import subprocess as sp
    import os
    import sys
    outfile = os.path.join('public', 'temp_subs.vtt')
    proc = sp.Popen(['ffmpeg.exe', '-hide_banner', '-i', video_file, '-map', '0:s:0', '-y', outfile],
        stdin=sp.DEVNULL, stderr=sp.STDOUT, stdout=sp.PIPE)
    proc.wait()
    output = proc.stdout.read()
    sys.stdout.buffer.write(output + b'\n')
    if b' matches no streams.' in output:
        print('No subtitle stream found in the video file.')
        return try_finding_subtitles(video_file)
    else:
        return outfile


def extract_subtitles_bytes(video_file):
    import subprocess as sp
    import sys
    proc = sp.Popen(['ffmpeg.exe', '-hide_banner', '-i', video_file, '-map', '0:s:0', '-y', '-'],
        stdin=sp.DEVNULL, stderr=sp.PIPE, stdout=sp.PIPE)
    proc.wait()
    output = proc.stderr.read()
    sys.stdout.buffer.write(output + b'\n')  # print ffmpeg output to console for debugging
    if b' matches no streams.' in output:
        print('No subtitle stream found in the video file.')
        # return try_finding_subtitles(video_file)
        with open(try_finding_subtitles(video_file), 'rb') as f:
            return f.read()
    else:
        return proc.stdout.read()

def try_finding_subtitles(video_file):
    # try finding other subtitle files in the same directory
    import os
    dirpath = os.path.dirname(video_file)
    from difflib import SequenceMatcher
    exts = ("srt","vtt","ass","ssa","scc","stl","ttml","sbv","sub","mpl")
    files = [os.path.join(dirpath, f) for f in os.listdir(dirpath)]
    files = [f for f in files if os.path.isfile(f) and f.split('.')[-1].lower() in exts]
    if not files:
        return ''
    basename = os.path.basename(video_file).split('.')[0]
    best_match = max(files, key=lambda f: SequenceMatcher(None, os.path.basename(f).split('.')[0], basename).ratio())
    print('Found subtitle file:', best_match)
    if best_match.endswith('.vtt'):
        return best_match
    else:
        return convert_to_vtt(best_match)

